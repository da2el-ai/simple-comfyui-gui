package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

// SelectorItem は 1 つのプロンプトエントリ
type SelectorItem struct {
	Name   string `json:"name"`
	Prompt string `json:"prompt"`
}

// SelectorSubcategory はサブカテゴリとそれに属するアイテム一覧
type SelectorSubcategory struct {
	Subcategory string          `json:"subcategory"`
	Items       []SelectorItem  `json:"items"`
}

// SelectorAllData はファイル名（メインカテゴリ）→サブカテゴリ一覧のマップ
type SelectorAllData map[string][]SelectorSubcategory

// ─────────────────────────────────────────────
// ハンドラー
// ─────────────────────────────────────────────

// GET /api/selector/
func (s *StaticServer) handleSelectorGet(w http.ResponseWriter, _ *http.Request) {
	if s.selectorDir == "" {
		writeJSON(w, http.StatusOK, SelectorAllData{})
		return
	}

	data, err := loadAllSelectorFiles(s.selectorDir)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, data)
}

type selectorAddRequest struct {
	Category       string `json:"category"`
	NewCategory    string `json:"new_category"`
	Subcategory    string `json:"subcategory"`
	NewSubcategory string `json:"new_subcategory"`
	Name           string `json:"name"`
	Prompt         string `json:"prompt"`
}

// POST /api/selector/add
func (s *StaticServer) handleSelectorAdd(w http.ResponseWriter, r *http.Request) {
	var req selectorAddRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	category := req.Category
	if category == "__new__" {
		category = strings.TrimSpace(req.NewCategory)
	}
	subcategory := req.Subcategory
	if subcategory == "__new__" {
		subcategory = strings.TrimSpace(req.NewSubcategory)
	}

	if category == "" || subcategory == "" || req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "category, subcategory, name は必須です"})
		return
	}

	filePath := filepath.Join(s.selectorDir, category+".yml")
	if err := addSelectorItem(filePath, subcategory, req.Name, req.Prompt); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type selectorEditRequest struct {
	NewName   string `json:"new_name"`
	NewPrompt string `json:"new_prompt"`
}

// POST /api/selector/edit/{category}/{subcategory}/{name}
func (s *StaticServer) handleSelectorEdit(w http.ResponseWriter, r *http.Request) {
	// /api/selector/edit/ 以降を "category/subcategory/name" として分割
	rest := strings.TrimPrefix(r.URL.Path, "/api/selector/edit/")
	parts := strings.SplitN(rest, "/", 3)
	if len(parts) != 3 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "パスが不正です。/api/selector/edit/{category}/{subcategory}/{name} の形式で指定してください"})
		return
	}
	category, subcategory, name := parts[0], parts[1], parts[2]

	var req selectorEditRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	filePath := filepath.Join(s.selectorDir, category+".yml")
	if err := editSelectorItem(filePath, subcategory, name, req.NewName, req.NewPrompt); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

type selectorDeleteRequest struct {
	Type        string `json:"type"`        // "item" | "subcategory" | "category"
	Category    string `json:"category"`
	Subcategory string `json:"subcategory"`
	Name        string `json:"name"`
}

// POST /api/selector/delete
func (s *StaticServer) handleSelectorDelete(w http.ResponseWriter, r *http.Request) {
	var req selectorDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	filePath := filepath.Join(s.selectorDir, req.Category+".yml")

	var err error
	switch req.Type {
	case "item":
		err = deleteSelectorItem(filePath, req.Subcategory, req.Name)
	case "subcategory":
		err = deleteSelectorSubcategory(filePath, req.Subcategory)
	case "category":
		err = os.Remove(filePath)
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "type は item / subcategory / category のいずれかです"})
		return
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ─────────────────────────────────────────────
// YAML 読み込み
// ─────────────────────────────────────────────

func loadAllSelectorFiles(dir string) (SelectorAllData, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	result := make(SelectorAllData)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		ext := filepath.Ext(name)
		if ext != ".yml" && ext != ".yaml" {
			continue
		}

		category := strings.TrimSuffix(name, ext)
		filePath := filepath.Join(dir, name)

		subcats, err := loadSelectorFile(filePath)
		if err != nil {
			continue
		}
		result[category] = subcats
	}

	return result, nil
}

func loadSelectorFile(filePath string) ([]SelectorSubcategory, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}

	root := getDocRoot(&doc)
	if root == nil || root.Kind != yaml.MappingNode {
		return []SelectorSubcategory{}, nil
	}

	var subcats []SelectorSubcategory
	for i := 0; i+1 < len(root.Content); i += 2 {
		subcatName := root.Content[i].Value
		subcatNode := root.Content[i+1]
		items := parseItemsFromNode(subcatNode)
		subcats = append(subcats, SelectorSubcategory{
			Subcategory: subcatName,
			Items:       items,
		})
	}

	return subcats, nil
}

func parseItemsFromNode(node *yaml.Node) []SelectorItem {
	var items []SelectorItem

	if node.Kind != yaml.MappingNode {
		return items
	}

	// key-value 形式: 女性: 1girl, blonde hair
	for i := 0; i+1 < len(node.Content); i += 2 {
		key := node.Content[i].Value
		val := node.Content[i+1].Value
		items = append(items, SelectorItem{Name: key, Prompt: val})
	}

	return items
}

// ─────────────────────────────────────────────
// YAML 書き込みヘルパー
// ─────────────────────────────────────────────

func loadDocNode(filePath string) (*yaml.Node, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// 新規ファイル用の空ドキュメントを返す
			return &yaml.Node{
				Kind: yaml.DocumentNode,
				Content: []*yaml.Node{
					{Kind: yaml.MappingNode, Tag: "!!map"},
				},
			}, nil
		}
		return nil, err
	}

	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	return &doc, nil
}

func saveDocNode(filePath string, doc *yaml.Node) error {
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return err
	}

	f, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	encoder := yaml.NewEncoder(f)
	encoder.SetIndent(2)
	return encoder.Encode(doc)
}

func getDocRoot(doc *yaml.Node) *yaml.Node {
	if doc.Kind == yaml.DocumentNode && len(doc.Content) > 0 {
		return doc.Content[0]
	}
	return nil
}

// findMappingKeyIndex は mapping ノード内でキー名が一致する先頭インデックスを返す（なければ -1）
func findMappingKeyIndex(mapping *yaml.Node, key string) int {
	for i := 0; i+1 < len(mapping.Content); i += 2 {
		if mapping.Content[i].Value == key {
			return i
		}
	}
	return -1
}

func newStringNode(value string) *yaml.Node {
	return &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: value}
}

// ─────────────────────────────────────────────
// CRUD 操作
// ─────────────────────────────────────────────

func addSelectorItem(filePath, subcategory, name, prompt string) error {
	doc, err := loadDocNode(filePath)
	if err != nil {
		return err
	}

	root := getDocRoot(doc)
	if root == nil {
		return fmt.Errorf("無効な YAML 構造です")
	}

	idx := findMappingKeyIndex(root, subcategory)

	if idx == -1 {
		// サブカテゴリが存在しない場合は key-value マッピングとして新規追加
		valNode := &yaml.Node{
			Kind: yaml.MappingNode,
			Tag:  "!!map",
			Content: []*yaml.Node{
				newStringNode(name),
				newStringNode(prompt),
			},
		}
		root.Content = append(root.Content, newStringNode(subcategory), valNode)
	} else {
		subcatNode := root.Content[idx+1]
		subcatNode.Content = append(subcatNode.Content,
			newStringNode(name),
			newStringNode(prompt),
		)
	}

	return saveDocNode(filePath, doc)
}

func editSelectorItem(filePath, subcategory, name, newName, newPrompt string) error {
	doc, err := loadDocNode(filePath)
	if err != nil {
		return err
	}

	root := getDocRoot(doc)
	if root == nil {
		return fmt.Errorf("無効な YAML 構造です")
	}

	idx := findMappingKeyIndex(root, subcategory)
	if idx == -1 {
		return fmt.Errorf("サブカテゴリ %q が見つかりません", subcategory)
	}

	subcatNode := root.Content[idx+1]
	itemIdx := findMappingKeyIndex(subcatNode, name)
	if itemIdx == -1 {
		return fmt.Errorf("アイテム %q が見つかりません", name)
	}
	if newName != "" {
		subcatNode.Content[itemIdx].Value = newName
	}
	if newPrompt != "" {
		subcatNode.Content[itemIdx+1].Value = newPrompt
	}

	return saveDocNode(filePath, doc)
}

func deleteSelectorItem(filePath, subcategory, name string) error {
	doc, err := loadDocNode(filePath)
	if err != nil {
		return err
	}

	root := getDocRoot(doc)
	if root == nil {
		return fmt.Errorf("無効な YAML 構造です")
	}

	idx := findMappingKeyIndex(root, subcategory)
	if idx == -1 {
		return fmt.Errorf("サブカテゴリ %q が見つかりません", subcategory)
	}

	subcatNode := root.Content[idx+1]
	itemIdx := findMappingKeyIndex(subcatNode, name)
	if itemIdx == -1 {
		return fmt.Errorf("アイテム %q が見つかりません", name)
	}
	subcatNode.Content = append(subcatNode.Content[:itemIdx], subcatNode.Content[itemIdx+2:]...)

	return saveDocNode(filePath, doc)
}

func deleteSelectorSubcategory(filePath, subcategory string) error {
	doc, err := loadDocNode(filePath)
	if err != nil {
		return err
	}

	root := getDocRoot(doc)
	if root == nil {
		return fmt.Errorf("無効な YAML 構造です")
	}

	idx := findMappingKeyIndex(root, subcategory)
	if idx == -1 {
		return fmt.Errorf("サブカテゴリ %q が見つかりません", subcategory)
	}

	root.Content = append(root.Content[:idx], root.Content[idx+2:]...)
	return saveDocNode(filePath, doc)
}
