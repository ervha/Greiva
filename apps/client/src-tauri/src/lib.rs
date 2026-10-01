use greiva_page_store::{PageStore, StoredPage, PageMetadata, LocalOperation, StructuredSnapshot, PullBatch};
use std::path::PathBuf;
use tauri::Manager;
use tokio::sync::OnceCell;

struct LocalStore { path: PathBuf, store: OnceCell<PageStore> }
impl LocalStore {
    async fn get(&self) -> Result<&PageStore, String> {
        self.store.get_or_try_init(|| PageStore::open(&self.path)).await
    }
}
#[tauri::command]
async fn page_list(state: tauri::State<'_, LocalStore>) -> Result<Vec<PageMetadata>, String> {
    state.get().await?.list().await
}
#[tauri::command]
async fn page_load(page_id: String, state: tauri::State<'_, LocalStore>) -> Result<StoredPage, String> {
    state.get().await?.load(&page_id).await
}
#[tauri::command]
async fn page_append(page_id: String, update: Vec<u8>, state: tauri::State<'_, LocalStore>) -> Result<(), String> {
    state.get().await?.append(&page_id, &update).await
}
#[tauri::command]
async fn page_set_title(page_id: String, title: String, state: tauri::State<'_, LocalStore>) -> Result<(), String> {
    state.get().await?.set_title(&page_id, &title).await
}
#[tauri::command]
async fn structured_snapshot(state: tauri::State<'_, LocalStore>) -> Result<StructuredSnapshot, String> {
    state.get().await?.structured_snapshot().await
}
#[tauri::command]
async fn structured_client_id(candidate: String, state: tauri::State<'_, LocalStore>) -> Result<String, String> {
    state.get().await?.structured_client_id(&candidate).await
}
#[tauri::command]
async fn structured_mutate(operation: LocalOperation, state: tauri::State<'_, LocalStore>) -> Result<serde_json::Value, String> {
    state.get().await?.structured_mutate(operation).await
}
#[tauri::command]
async fn structured_prepare(state: tauri::State<'_, LocalStore>) -> Result<Option<serde_json::Value>, String> {
    state.get().await?.structured_prepare().await
}
#[tauri::command]
async fn structured_ack(result: serde_json::Value, state: tauri::State<'_, LocalStore>) -> Result<(), String> {
    state.get().await?.structured_ack(result).await
}
#[tauri::command]
async fn structured_pull(base_cursor: Option<String>, batch: PullBatch, state: tauri::State<'_, LocalStore>) -> Result<(), String> {
    state.get().await?.structured_pull(base_cursor,batch).await
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(debug_assertions)]
    eprintln!("Greiva native startup: constructing application");
    let application = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            #[cfg(debug_assertions)]
            eprintln!("Greiva native startup: setup entered");
            let mut directory = app.path().app_config_dir()?;
            // Test isolation only in debug shells; frontend cannot select an arbitrary path.
            #[cfg(debug_assertions)]
            if let Some(path) = std::env::var_os("GREIVA_TEST_DATA_DIR") { directory = PathBuf::from(path); }
            std::fs::create_dir_all(&directory)?;
            app.manage(LocalStore { path: directory.join("greiva.sqlite"), store: OnceCell::new() });
            #[cfg(debug_assertions)]
            eprintln!("Greiva native startup: local store configured");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![page_list, page_load, page_append, page_set_title, structured_snapshot, structured_mutate, structured_client_id, structured_prepare, structured_ack, structured_pull])
        .build(tauri::generate_context!())
        .expect("Greiva PoC failed to start");
    #[cfg(debug_assertions)]
    eprintln!("Greiva native startup: application built; entering event loop");
    application.run(|_, _| {});
}
