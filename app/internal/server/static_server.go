package server

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
)

const defaultPort = 3000

type StaticServer struct {
	server      *http.Server
	listener    net.Listener
	frontendDir string
	workflowDir string
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
	mux.Handle("/workflow/", http.StripPrefix("/workflow/", http.FileServer(http.Dir(staticServer.workflowDir))))
	mux.Handle("/", newFrontendHandler(staticServer.frontendDir))

	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", defaultPort))
	if err != nil {
		listener, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return err
		}
	}

	staticServer.listener = listener
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
	if staticServer.listener == nil {
		return ""
	}

	return fmt.Sprintf("http://%s", staticServer.listener.Addr().String())
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
