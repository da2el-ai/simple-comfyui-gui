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
	tagsFile    string
	localURL    string
	accessURLs  []string
}

func NewStaticServer() *StaticServer {
	return &StaticServer{}
}

func (staticServer *StaticServer) Start() error {
	frontendDir, workflowDir, tagsFile, err := resolveStaticDirs()
	if err != nil {
		return err
	}

	staticServer.frontendDir = frontendDir
	staticServer.workflowDir = workflowDir
	staticServer.tagsFile = tagsFile

	mux := http.NewServeMux()
	mux.HandleFunc("/api/comfyui_endpoint", staticServer.handleComfyUIEndpoint)
	mux.HandleFunc("/api/workflows", staticServer.handleWorkflows)
	mux.HandleFunc("/api/tags", staticServer.handleTags)
	mux.Handle("/workflow/", newWorkflowHandler(staticServer.workflowDir))
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
		staticServer.accessURLs = buildAccessURLs(tcpAddress.Port)
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

func (staticServer *StaticServer) AccessURLs() []string {
	cloned := make([]string, len(staticServer.accessURLs))
	copy(cloned, staticServer.accessURLs)
	return cloned
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

func newWorkflowHandler(workflowDir string) http.Handler {
	fileServer := http.StripPrefix("/workflow/", http.FileServer(http.Dir(workflowDir)))

	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		response.Header().Set("Pragma", "no-cache")
		response.Header().Set("Expires", "0")
		fileServer.ServeHTTP(response, request)
	})
}

func resolveStaticDirs() (string, string, string, error) {
	executablePath, err := os.Executable()
	if err != nil {
		return "", "", "", err
	}

	executableDir := filepath.Dir(executablePath)

	checkedPaths := make([]string, 0)
	for depth := 0; depth <= 8; depth++ {
		ancestorDir := executableDir
		for i := 0; i < depth; i++ {
			ancestorDir = filepath.Dir(ancestorDir)
		}

		directFrontend := filepath.Join(ancestorDir, "frontend")
		directWorkflow := filepath.Join(ancestorDir, "workflow")
		checkedPaths = append(checkedPaths, directFrontend, directWorkflow)
		if directoryExists(directFrontend) && directoryExists(directWorkflow) {
			return directFrontend, directWorkflow, resolveTagsFile(ancestorDir), nil
		}

		runtimeFrontend := filepath.Join(ancestorDir, "runtime", "frontend")
		runtimeWorkflow := filepath.Join(ancestorDir, "runtime", "workflow")
		checkedPaths = append(checkedPaths, runtimeFrontend, runtimeWorkflow)
		if directoryExists(runtimeFrontend) && directoryExists(runtimeWorkflow) {
			return runtimeFrontend, runtimeWorkflow, resolveTagsFile(ancestorDir), nil
		}
	}

	return "", "", "", errors.New("frontend/workflow の配置が見つかりません。探索パス: " + strings.Join(checkedPaths, ", "))
}

func resolveTagsFile(ancestorDir string) string {
	directTagsFile := filepath.Join(ancestorDir, "tags", "autocomplete.csv")
	if fileExists(directTagsFile) {
		return directTagsFile
	}

	runtimeTagsFile := filepath.Join(ancestorDir, "runtime", "tags", "autocomplete.csv")
	if fileExists(runtimeTagsFile) {
		return runtimeTagsFile
	}

	return ""
}

func directoryExists(path string) bool {
	stat, err := os.Stat(path)
	if err != nil {
		return false
	}

	return stat.IsDir()
}

func fileExists(path string) bool {
	stat, err := os.Stat(path)
	if err != nil {
		return false
	}

	return !stat.IsDir()
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

func (staticServer *StaticServer) handleTags(response http.ResponseWriter, request *http.Request) {
	if staticServer.tagsFile == "" || !fileExists(staticServer.tagsFile) {
		writeJSON(response, http.StatusNotFound, map[string]string{
			"error": "tagsファイルが見つかりません",
		})
		return
	}

	response.Header().Set("Content-Type", "text/csv; charset=utf-8")
	http.ServeFile(response, request, staticServer.tagsFile)
}

func writeJSON(response http.ResponseWriter, statusCode int, payload any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(statusCode)

	_ = json.NewEncoder(response).Encode(payload)
}

func buildAccessURLs(port int) []string {
	urls := []string{}
	ipAddresses := collectCandidateIPv4s()
	for _, ipAddress := range ipAddresses {
		urls = append(urls, fmt.Sprintf("http://%s:%d", ipAddress, port))
	}

	return dedupeStrings(urls)
}

func collectCandidateIPv4s() []string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return []string{}
	}

	type ipCandidate struct {
		ip    string
		score int
	}

	candidates := make([]ipCandidate, 0)

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

			if !isTargetIP(ip, networkInterface.Name) {
				continue
			}

			score := interfaceScore(networkInterface.Name)

			candidates = append(candidates, ipCandidate{ip: ip.String(), score: score})
		}
	}

	sort.SliceStable(candidates, func(left int, right int) bool {
		if candidates[left].score != candidates[right].score {
			return candidates[left].score < candidates[right].score
		}
		return candidates[left].ip < candidates[right].ip
	})

	result := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		result = append(result, candidate.ip)
	}

	return dedupeStrings(result)
}

func isTargetIP(ip net.IP, interfaceName string) bool {
	if ip == nil {
		return false
	}

	interfaceNameLower := strings.ToLower(interfaceName)
	if strings.Contains(interfaceNameLower, "tailscale") || strings.HasPrefix(interfaceNameLower, "utun") {
		return isCarrierGradeNAT(ip) || isPrivateIP(ip)
	}

	return isPrivateIP(ip)
}

func interfaceScore(interfaceName string) int {
	interfaceNameLower := strings.ToLower(interfaceName)

	if strings.Contains(interfaceNameLower, "tailscale") || strings.HasPrefix(interfaceNameLower, "utun") {
		return 0
	}

	if strings.HasPrefix(interfaceNameLower, "en") || strings.Contains(interfaceNameLower, "wi-fi") || strings.Contains(interfaceNameLower, "wifi") || strings.Contains(interfaceNameLower, "ethernet") {
		return 1
	}

	return 2
}

func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return false
	}

	first := ip[0]
	second := ip[1]

	if first == 10 {
		return true
	}

	if first == 172 && second >= 16 && second <= 31 {
		return true
	}

	if first == 192 && second == 168 {
		return true
	}

	return false
}

func isCarrierGradeNAT(ip net.IP) bool {
	if ip == nil {
		return false
	}

	first := ip[0]
	second := ip[1]
	return first == 100 && second >= 64 && second <= 127
}

func dedupeStrings(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))

	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}

	return result
}
