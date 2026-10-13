fn main() {
    let names=["GREIVA_NATIVE_PROJECT_URL","GREIVA_NATIVE_API_ORIGIN","GREIVA_NATIVE_PUBLISHABLE_KEY"];
    for name in names {println!("cargo:rerun-if-env-changed={name}");}
    let values:Vec<_>=names.iter().map(|name|std::env::var(name).ok()).collect();
    let expression=if values.iter().all(Option::is_none){"None".to_string()}else {
        if values.iter().any(|value|value.as_ref().is_none_or(String::is_empty)){panic!("Complete explicit native authentication configuration required");}
        format!("Some(({:?},{:?},{:?}))",values[0].as_ref().unwrap(),values[1].as_ref().unwrap(),values[2].as_ref().unwrap())
    };
    std::fs::write(std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("native-auth-config.rs"),format!("pub(crate) const CONFIG:Option<(&str,&str,&str)>={expression};\n")).unwrap();
    tauri_build::build()
}
