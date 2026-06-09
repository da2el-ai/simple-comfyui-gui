package server

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"simple-comfyui-gui/app/internal/comfyui"
	"simple-comfyui-gui/app/internal/config"
)

const defaultPort = 3000

type StaticServer struct {
	server      *http.Server
	listener    net.Listener
	frontendDir string
	workflowDir string
	tagsFile    string
	versionFile string
	selectorDir string
	localURL    string
	accessURLs  []string
}

func NewStaticServer() *StaticServer {
	return &StaticServer{}
}

func (staticServer *StaticServer) Start() error {
	frontendDir, workflowDir, tagsFile, versionFile, err := resolveStaticDirs()
	if err != nil {
		return err
	}

	staticServer.frontendDir = frontendDir
	staticServer.workflowDir = workflowDir
	staticServer.tagsFile = tagsFile
	staticServer.versionFile = versionFile
	staticServer.selectorDir = resolveSelectorDir()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/comfyui_endpoint", staticServer.handleComfyUIEndpoint)
	mux.HandleFunc("/api/version", staticServer.handleVersion)
	mux.HandleFunc("/api/object_info", staticServer.handleObjectInfo)
	mux.HandleFunc("/api/workflows", staticServer.handleWorkflows)
	mux.HandleFunc("/api/tags", staticServer.handleTags)
	mux.HandleFunc("/api/selector/", staticServer.handleSelectorGet)
	mux.HandleFunc("/api/selector/add", staticServer.handleSelectorAdd)
	mux.HandleFunc("/api/selector/edit/", staticServer.handleSelectorEdit)
	mux.HandleFunc("/api/selector/delete", staticServer.handleSelectorDelete)
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

func (staticServer *StaticServer) TagsFilePath() string {
	return staticServer.tagsFile
}

// Version は version.txt を読み込み、前後の空白・改行を除いたバージョン文字列を返す。
// ファイルが無い／読めない場合は空文字列を返し、呼び出し側でフォールバックする。
// 実行時にファイルを読むため、再ビルドなしでバージョン表示を更新できる。
func (staticServer *StaticServer) Version() string {
	if staticServer.versionFile == "" {
		return ""
	}

	content, err := os.ReadFile(staticServer.versionFile)
	if err != nil {
		return ""
	}

	return strings.TrimSpace(string(content))
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

// ワークフローファイル(.json/.yaml)を配信するハンドラを生成する。
// 更新が即座に反映されるよう、キャッシュを無効化するヘッダーを常に付与する。
func newWorkflowHandler(workflowDir string) http.Handler {
	fileServer := http.StripPrefix("/workflow/", http.FileServer(http.Dir(workflowDir)))

	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		response.Header().Set("Pragma", "no-cache")
		response.Header().Set("Expires", "0")
		fileServer.ServeHTTP(response, request)
	})
}

// 実行ファイルの位置を起点に、frontend / workflow ディレクトリと
// タグファイルの配置場所を探索して返す。実行ファイルのある階層から最大8階層上まで遡り、
// 各階層で直下 (frontend/workflow) と runtime 配下 (runtime/frontend, runtime/workflow) の
// 両パターンを確認する。開発時とビルド後で配置が異なるケースに対応するための探索処理。
// 見つからない場合は探索したパス一覧を含むエラーを返す。
func resolveStaticDirs() (string, string, string, string, error) {
	executablePath, err := os.Executable()
	if err != nil {
		return "", "", "", "", err
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
			return directFrontend, directWorkflow, resolveTagsFile(ancestorDir), resolveVersionFile(ancestorDir), nil
		}

		runtimeFrontend := filepath.Join(ancestorDir, "runtime", "frontend")
		runtimeWorkflow := filepath.Join(ancestorDir, "runtime", "workflow")
		checkedPaths = append(checkedPaths, runtimeFrontend, runtimeWorkflow)
		if directoryExists(runtimeFrontend) && directoryExists(runtimeWorkflow) {
			return runtimeFrontend, runtimeWorkflow, resolveTagsFile(ancestorDir), resolveVersionFile(ancestorDir), nil
		}
	}

	return "", "", "", "", errors.New("frontend/workflow の配置が見つかりません。探索パス: " + strings.Join(checkedPaths, ", "))
}

// 指定階層を基準にバージョン情報ファイル version.txt のパスを解決する。
// 直下 (version.txt) と runtime 配下 (runtime/version.txt) を順に確認し、
// 実ファイルがあればそのパスを返す。いずれも無ければ runtime 配下のパスを既定値として返す。
func resolveVersionFile(ancestorDir string) string {
	directVersionFile := filepath.Join(ancestorDir, "version.txt")
	if fileExists(directVersionFile) {
		return directVersionFile
	}

	runtimeVersionFile := filepath.Join(ancestorDir, "runtime", "version.txt")
	if fileExists(runtimeVersionFile) {
		return runtimeVersionFile
	}

	return runtimeVersionFile
}

// 指定階層を基準にオートコンプリート用タグCSVのパスを解決する。
// 直下 (tags/autocomplete.csv) と runtime 配下 (runtime/tags/autocomplete.csv) を順に確認し、
// 実ファイルがあればそのパスを返す。ファイルが無くてもディレクトリが存在すれば
// 想定パスを返し、いずれも無ければ直下パスを既定値として返す。
func resolveTagsFile(ancestorDir string) string {
	directTagsFile := filepath.Join(ancestorDir, "tags", "autocomplete.csv")
	if fileExists(directTagsFile) {
		return directTagsFile
	}

	runtimeTagsFile := filepath.Join(ancestorDir, "runtime", "tags", "autocomplete.csv")
	if fileExists(runtimeTagsFile) {
		return runtimeTagsFile
	}

	if directoryExists(filepath.Join(ancestorDir, "tags")) {
		return directTagsFile
	}

	if directoryExists(filepath.Join(ancestorDir, "runtime", "tags")) {
		return runtimeTagsFile
	}

	return directTagsFile
}

// セレクター定義ファイルを格納するディレクトリを探索して返す。
// resolveStaticDirs と同様に実行ファイルから最大8階層上まで遡り、直下 (selector) と
// runtime 配下 (runtime/selector) を確認する。見つからない場合は空文字列を返す。
func resolveSelectorDir() string {
	executablePath, err := os.Executable()
	if err != nil {
		return ""
	}

	executableDir := filepath.Dir(executablePath)
	for depth := 0; depth <= 8; depth++ {
		ancestorDir := executableDir
		for i := 0; i < depth; i++ {
			ancestorDir = filepath.Dir(ancestorDir)
		}

		direct := filepath.Join(ancestorDir, "selector")
		if directoryExists(direct) {
			return direct
		}

		runtime := filepath.Join(ancestorDir, "runtime", "selector")
		if directoryExists(runtime) {
			return runtime
		}
	}

	return ""
}

// 指定パスが存在し、かつディレクトリである場合に true を返す。
func directoryExists(path string) bool {
	stat, err := os.Stat(path)
	if err != nil {
		return false
	}

	return stat.IsDir()
}

// 指定パスが存在し、かつディレクトリではない（通常ファイルである）場合に true を返す。
func fileExists(path string) bool {
	stat, err := os.Stat(path)
	if err != nil {
		return false
	}

	return !stat.IsDir()
}

// 設定済みの ComfyUI 接続先URLをJSONで返すAPIハンドラ。
// フロントエンドが ComfyUI API へ直接アクセスするための接続先を取得するのに使う。
// 設定の読み込みに失敗した場合は既定設定を用いる。
func (staticServer *StaticServer) handleComfyUIEndpoint(response http.ResponseWriter, _ *http.Request) {
	loadedConfig, err := config.Load()
	if err != nil {
		loadedConfig = config.DefaultConfig()
	}

	writeJSON(response, http.StatusOK, map[string]string{
		"endpoint": loadedConfig.ComfyUIURL,
	})
}

// handleVersion は version.txt のバージョン文字列をJSONで返すAPIハンドラ。
// フロントエンドがページ最下部にバージョンを表示するために使う。
// ファイルが無い場合は空文字列を返す（フロント側でバージョン表記を省略する）。
func (staticServer *StaticServer) handleVersion(response http.ResponseWriter, _ *http.Request) {
	writeJSON(response, http.StatusOK, map[string]string{
		"version": staticServer.Version(),
	})
}

// handleObjectInfo はComfyUIの/object_infoをプロキシして返すAPIハンドラ。
// ComfyUIから取得した約12MBのJSONを、クライアントがgzipを受け入れる場合はgzip圧縮して返す。
// これによりTailscale等の低速回線越し（スマホ）での転送量を削減し、表示時間を短縮する。
// 重い12MBの取得(ComfyUI→Go)はローカル接続で行い、回線を流れるのは圧縮済みデータのみとなる。
// キャッシュは持たず、毎回ComfyUIから取得するため常に最新の内容を返す。
func (staticServer *StaticServer) handleObjectInfo(response http.ResponseWriter, request *http.Request) {
	loadedConfig, err := config.Load()
	if err != nil {
		loadedConfig = config.DefaultConfig()
	}

	body, err := comfyui.FetchObjectInfo(request.Context(), loadedConfig.ComfyUIURL)
	if err != nil {
		writeJSON(response, http.StatusBadGateway, map[string]string{
			"error": "object_infoの取得に失敗しました",
		})
		return
	}

	response.Header().Set("Content-Type", "application/json")
	response.Header().Set("Vary", "Accept-Encoding")

	// クライアントがgzipを受け入れない場合は非圧縮のまま返す（フォールバック）
	if !strings.Contains(request.Header.Get("Accept-Encoding"), "gzip") {
		_, _ = response.Write(body)
		return
	}

	response.Header().Set("Content-Encoding", "gzip")
	gzipWriter := gzip.NewWriter(response)
	defer gzipWriter.Close()
	_, _ = gzipWriter.Write(body)
}

// ワークフローディレクトリ内の .json ファイルを走査し、
// 拡張子を除いたワークフロー名の一覧をソートしてJSONで返すAPIハンドラ。
// フロントエンドのワークフロー選択肢を構築するために使う。
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

// オートコンプリート用タグCSVファイルをそのまま配信するAPIハンドラ。
// ファイルが未解決または存在しない場合は 404 をJSONで返す。
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

// 指定したステータスコードとペイロードをJSON形式でレスポンスに書き込む共通ヘルパー。
// Content-Type ヘッダーを設定し、payload をエンコードして返す。
func writeJSON(response http.ResponseWriter, statusCode int, payload any) {
	response.Header().Set("Content-Type", "application/json")
	response.WriteHeader(statusCode)

	_ = json.NewEncoder(response).Encode(payload)
}

// 指定ポートに対し、LAN内端末からアクセス可能なURL一覧を構築する。
// 候補となるIPv4アドレスを収集し、それぞれを http://IP:ポート 形式に整形して重複を除いて返す。
func buildAccessURLs(port int) []string {
	urls := []string{}
	ipAddresses := collectCandidateIPv4s()
	for _, ipAddress := range ipAddresses {
		urls = append(urls, fmt.Sprintf("http://%s:%d", ipAddress, port))
	}

	return dedupeStrings(urls)
}

// はアクセスURLに使うIPv4アドレス候補を収集して返す。
// 稼働中かつ非ループバックのネットワークインターフェースを走査し、
// プライベートIPや Tailscale 経由のアドレスのみを対象とする。
// インターフェース種別に応じたスコアで並べ替え（Tailscale を最優先、次に有線/無線）、
// アクセスに使いやすい順序で重複を除いたアドレス一覧を返す。
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

// 指定IPがアクセスURLの対象として妥当かを判定する。
// Tailscale / utun インターフェースの場合は CGNAT 帯(100.64.0.0/10)も含めて許可し、
// それ以外のインターフェースではプライベートIPのみを対象とする。
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

// インターフェース名から並べ替え用の優先度スコアを返す（小さいほど優先）。
// Tailscale / utun を 0（最優先）、有線・無線(en/wi-fi/ethernet)を 1、それ以外を 2 とする。
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

// 指定IPがプライベートIPアドレス帯
// (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) に属するかを判定する。
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

// 指定IPがキャリアグレードNAT帯(100.64.0.0/10)に属するかを判定する。
// Tailscale が割り当てるアドレスの判別に使う。
func isCarrierGradeNAT(ip net.IP) bool {
	if ip == nil {
		return false
	}

	first := ip[0]
	second := ip[1]
	return first == 100 && second >= 64 && second <= 127
}

// 文字列スライスから空文字列と重複を除き、
// 出現順を保ったまま一意な値のスライスを返すヘルパー。
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
