fn main() {
    let offline_names=["GREIVA_NATIVE_OFFLINE_ISSUER","GREIVA_NATIVE_OFFLINE_AUDIENCE","GREIVA_NATIVE_OFFLINE_KID","GREIVA_NATIVE_OFFLINE_PUBLIC_KEY"];
    for name in offline_names {println!("cargo:rerun-if-env-changed={name}");}
    let offline:Vec<_>=offline_names.iter().map(|name|std::env::var(name).ok()).collect();
    let offline_expression=if offline.iter().all(Option::is_none){"None".to_string()}else{
        if offline.iter().any(|v|v.as_ref().is_none_or(|s|s.is_empty()||s.chars().any(char::is_control))){panic!("Complete explicit native offline public configuration required");}
        let key=offline[3].as_ref().unwrap();if key.len()!=64||!key.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){panic!("Invalid native offline public configuration");}
        format!("Some(({:?},{:?},{:?},{:?}))",offline[0].as_ref().unwrap(),offline[1].as_ref().unwrap(),offline[2].as_ref().unwrap(),key)
    };
    let names=["GREIVA_NATIVE_PROJECT_URL","GREIVA_NATIVE_API_ORIGIN","GREIVA_NATIVE_PUBLISHABLE_KEY"];
    for name in names {println!("cargo:rerun-if-env-changed={name}");}
    let values:Vec<_>=names.iter().map(|name|std::env::var(name).ok()).collect();
    if offline.iter().any(Option::is_some)&&values.iter().any(Option::is_none){panic!("Native offline preparation requires explicit native authentication");}
    let expression=if values.iter().all(Option::is_none){"None".to_string()}else {
        if values.iter().any(|value|value.as_ref().is_none_or(String::is_empty)){panic!("Complete explicit native authentication configuration required");}
        format!("Some(({:?},{:?},{:?}))",values[0].as_ref().unwrap(),values[1].as_ref().unwrap(),values[2].as_ref().unwrap())
    };
    if values.iter().any(Option::is_some) {
        let dist=std::path::Path::new("../dist");
        if !dist.join("native.html").is_file() || std::fs::read_dir(dist).map(|files|files.filter_map(Result::ok).any(|file|file.path().extension().is_some_and(|ext|ext=="html")&&file.file_name()!="native.html")).unwrap_or(true) {
            panic!("Native authentication requires native-only frontend assets");
        }
    }
    std::fs::write(std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("native-auth-config.rs"),format!("pub(crate) const CONFIG:Option<(&str,&str,&str)>={expression};\n")).unwrap();
    std::fs::write(std::path::PathBuf::from(std::env::var_os("OUT_DIR").unwrap()).join("native-offline-config.rs"),format!("pub(crate) const OFFLINE_CONFIG:Option<(&str,&str,&str,&str)>={offline_expression};\n")).unwrap();
    tauri_build::build()
}
