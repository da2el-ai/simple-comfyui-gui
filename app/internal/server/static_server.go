package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"simple-comfyui-gui/app/internal/config"
)

const defaultPort = 3000

type StaticServer struct {
	server      *http.Server
	listener    net.Listener
	frontendDir string
	workflowDir string
	localURL    string
	lanURL      string
}

func NewStaticServer() *StaticServer {
	return &StaticServer{}
}

func (staticServer *StaticServer) Start() error {
	frontendDir, workflowDir, err := resolveStaticDirs()
	if err != nil {
		return err
	}

	staticServer.frontendDir = frontendDir
	staticServer.workflowDir = workflowDir

	mux := http.NewServeMux()
	mux.HandleFunc("/api/comfyui_endpoint", staticServer.handleComfyUIEndpoint)
	mux.HandleFunc("/api/workflows", staticServer.handleWorkflows)
	mux.Handle("/workflow/", http.StripPrefix("/workflow/", http.FileServer(http.Dir(staticServer.workflowDir))))
	mux.Handle("/", newFrontendHandler(staticServer.frontendDir))

	listener, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", defaultPort))
	if err != nil {
		listener, err = net.Listen("tcp", "0.0.0.0:0")
		if err != nil {
			return err
		}
	}

	staticServer.listener = listener
	tcpAddress, ok := listener.Addr().(*net.TCPAddr)
	if ok {
		staticServer.localURL = fmt.Sprintf("http://127.0.0.1:%d", tcpAddress.Port)
		localIP := detectLocalIPv4()
		if localIP != "" {
			staticServer.lanURL = fmt.Sprintf("http://%s:%d", localIP, tcpAddress.Port)
		} else {
			staticServer.lanURL = staticServer.localURL
		}
	}
	staticServer.server = &http.Server{Handler: mux}

	go func() {
		_ = staticServer.server.Serve(staticServer.listener)
	}()

	return nil
}

func (staticServer *StaticServer) Stop() error {
	if staticServer.server == nil {
		return nil
	}

	return staticServer.server.Close()
}

func (staticServer *StaticServer) URL() string {
	return staticServer.localURL
}

func (staticServer *StaticServer) LocalURL() string {
	return staticServer.localURL
}

func (staticServer *StaticServer) LANURL() string {
	return staticServer.lanURL
}

func newFrontendHandler(frontendDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(frontendDir))

	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/" {
			indexPath := filepath.Join(frontendDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(response, request, indexPath)
				return
			}
		}

		fileServer.ServeHTTP(response, request)
	})
}

func resolveStaticDirs() (string, string, error) {
	executablePath, err := os.Executable()
	if err != nil {
		return "", "", err
	}

	executableDir := filepath.Dir(executablePath)

	candidates := []string{
		filepath.Clean(filepath.Join(executableDir, "..")),
		filepath.Clean(filepath.Join(executableDir, "..", "..")),
		filepath.Clean(filepath.Join(executableDir, "runtime")),
		filepath.Clean(filepath.Join(executableDir, "..", "runtime")),
		filepath.Clean(filepath.Join(executableDir, "..", "..", "runtime")),
	}

	for _, baseDir := range candidates {
		frontendDir := filepath.Join(baseDir, "frontend")
		workflowDir := filepath.Join(baseDir, "workflow")

		if directoryExists(frontendDir) && directoryExists(workflowDir) {
			return frontendDir, workflowDir, nil
		}
	}

	return "", "", errors.New("runtime/frontend と runtime/workflow が見つかりません")
}

func directoryExists(path string) bool {
	stat, err := os.Stat(path)
	if err != nil {
		return false
	}

	return stat.IsDir()
}

func (staticServer *StaticServer) handleComfyUIEndpoint(response http.ResponseWriter, _ *http.Request) {
	loadedConfig, err := config.Load()
	if err != nil {
		loadedConfig = config.DefaultConfig()
	}

	writeJSON(response, http.StatusOK, map[string]string{
		"endpoint": loadedConfig.ComfyUIURL,
	})
}

func (staticServer *StaticServer) handleWorkflows(response http.ResponseWriter, _ *http.Request) {
	entries, err := os.ReadDir(staticServer.workflowDir)
	if err != nil {
		writeJSON(response, http.StatusInternalServerError, map[string]string{
			"error": "workflow一覧の取得に失敗しました",
		})
		return
	}

	workflowNames := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if filepath.Ext(name) != ".json" {
			continue
		}

		workflowNames = append(workflowNames, strings.TrimSuffix(name, ".json"))
	}

	sort.Strings(workflowNames)
	writeJSON(response, http.StatusOK, workflowNames)
}

func writeJSON(response http.ResponseWriter, statusCode int, payload any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(statusCode)

	_ = json.NewEncoder(response).Encode(payload)
}

func detectLocalIPv4() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	for _, networkInterface := range interfaces {
		if (networkInterface.Flags&net.FlagUp) == 0 || (networkInterface.Flags&net.FlagLoopback) != 0 {
			continue
		}

		addresses, err := networkInterface.Addrs()
		if err != nil {
			continue
		}

		for _, address := range addresses {
			ipNet, ok := address.(*net.IPNet)
			if !ok {
				continue
			}

			ip := ipNet.IP.To4()
			if ip == nil {
				continue
			}

			return ip.String()
		}
	}

	return ""
}
