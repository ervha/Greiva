// Config inspection only. Never starts a GUI or opens any application database.
fn main() {
    let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let config = context.config();
    let windows: Vec<_> = config.app.windows.iter().map(|window|serde_json::json!({"label":window.label,"url":window.url})).collect();
    println!("{}",serde_json::json!({"identifier":config.identifier,"productName":config.product_name,"version":config.version,"windows":windows,"csp":config.app.security.csp,"bundleActive":config.bundle.active}));
}