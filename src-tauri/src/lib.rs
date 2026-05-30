use std::sync::Mutex;
use std::process::Command as StdCommand;
use tokio::process::Command;
use tauri::{State, Manager};
use serde::{Deserialize, Serialize};

struct RepoState(Mutex<Option<String>>);

fn get_repo(state: &State<RepoState>) -> Result<String, String> {
    let guard = state.0.lock().unwrap();
    guard.as_ref().cloned().ok_or("未选择仓库".into())
}

async fn git_cmd_cached(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args([&["-C", repo], args].concat())
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

async fn git_out_cached(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args([&["-C", repo], args].concat())
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(format!("{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)))
}

// ============== Open Repo ==============
#[tauri::command]
async fn open_repo(path: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let output = Command::new("git").args(["-C", &path, "rev-parse", "--is-inside-work-tree"])
        .output().await.map_err(|e| e.to_string())?;
    let is_repo = output.status.success();
    if !is_repo {
        Command::new("git").args(["-C", &path, "init"]).output().await.map_err(|e| e.to_string())?;
    }
    *state.0.lock().unwrap() = Some(path.clone());
    save_recent(&path);
    Ok(serde_json::json!({ "path": path, "initialized": !is_repo }))
}

// ============== Git Status ==============
#[tauri::command]
async fn git_status(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;

    let branch_fut = Command::new("git").args(["-C", &repo, "rev-parse", "--abbrev-ref", "HEAD"]).output();
    let status_fut = git_out_cached(&repo, &["status", "--porcelain"]);
    let log_fut = git_out_cached(&repo, &["log", "--format=%H||%s||%an||%ae||%aI", "--max-count=10"]);

    let (branch_out, status_out, log_out) = tokio::join!(branch_fut, status_fut, log_fut);

    let branch = String::from_utf8_lossy(&branch_out.map_err(|e| e.to_string())?.stdout).trim().to_string();
    let status_out = status_out?;
    let log_out = log_out?;

    let mut modified = vec![];
    let mut not_added = vec![];
    let mut deleted = vec![];
    let mut staged = vec![];
    let mut renamed: Vec<String> = vec![];
    for line in status_out.lines() {
        if line.len() < 3 { continue }
        let (xy, file) = (&line[0..2], line[3..].trim());
        match &xy[0..1] {
            "M"|"A"|"D"|"R"|"C" => staged.push(file.to_string()),
            _ => {}
        }
        match &xy[1..2] {
            "M" => modified.push(file.to_string()),
            "?" => not_added.push(file.to_string()),
            "D" => deleted.push(file.to_string()),
            _ => {}
        }
        if xy.starts_with('R') {
            renamed.push(file.to_string());
        }
    }
    let is_clean = modified.is_empty() && not_added.is_empty() && deleted.is_empty() && staged.is_empty();

    let mut log_entries = vec![];
    for line in log_out.lines() {
        let parts: Vec<&str> = line.split("||").collect();
        if parts.len() >= 5 {
            log_entries.push(serde_json::json!({
                "hash": parts[0], "message": parts[1],
                "author_name": parts[2], "author_email": parts[3], "date": parts[4]
            }));
        }
    }

    Ok(serde_json::json!({
        "status": { "modified": modified, "not_added": not_added, "deleted": deleted,
                    "staged": staged, "created": vec![] as Vec<String>, "renamed": renamed,
                    "isClean": is_clean, "files": vec![] as Vec<String> },
        "branch": branch, "log": log_entries
    }))
}

// ============== Stage / Unstage / Commit ==============
macro_rules! simple_git {
    ($name:ident, $($arg:expr),*) => {
        #[tauri::command]
        async fn $name(files: Vec<String>, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
            let repo = get_repo(&state)?;
            let mut args: Vec<&str> = vec![$($arg),*];
            args.extend(files.iter().map(|s| s.as_str()));
            git_cmd_cached(&repo, &args).await?;
            Ok(serde_json::json!({ "success": true }))
        }
    };
}

simple_git!(git_stage, "add");
simple_git!(git_unstage, "reset", "--");

#[tauri::command]
async fn git_stage_all(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["add", "."]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_commit(message: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["commit", "-m", &message]).await?;
    Ok(serde_json::json!({ "success": true }))
}

// ============== Git Config ==============
#[tauri::command]
async fn git_get_global_config() -> Result<serde_json::Value, String> {
    let out = Command::new("git").args(["config", "--global", "--list"]).output().await.map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "config": String::from_utf8_lossy(&out.stdout).trim().to_string() }))
}

#[tauri::command]
async fn git_set_global_config(key: String, value: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let _repo = get_repo(&state)?;
    if value.is_empty() {
        Command::new("git").args(["config", "--global", "--unset", &key]).output().await.map_err(|e| e.to_string())?;
    } else {
        Command::new("git").args(["config", "--global", &key, &value]).output().await.map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({ "success": true }))
}

// ============== Remotes ==============
#[tauri::command]
async fn git_get_remotes(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let out = git_cmd_cached(&repo, &["remote", "-v"]).await?;
    let mut remotes: Vec<serde_json::Value> = vec![];
    let mut seen = std::collections::HashSet::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 && seen.insert(parts[0].to_string()) {
            remotes.push(serde_json::json!({
                "name": parts[0], "refs": { "fetch": parts[1] }
            }));
        }
    }
    Ok(serde_json::json!({ "remotes": remotes }))
}

#[tauri::command]
async fn git_set_remote(name: String, url: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let _ = Command::new("git").args(["-C", &repo, "remote", "remove", &name]).output().await;
    Command::new("git").args(["-C", &repo, "remote", "add", &name, &url]).output().await.map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_remove_remote(name: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["remote", "remove", &name]).await?;
    Ok(serde_json::json!({ "success": true }))
}

// ============== Push / Pull ==============
#[tauri::command]
async fn git_push(token: Option<String>, remote_name: Option<String>, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let remote_name = remote_name.unwrap_or("origin".into());
    let branch = String::from_utf8_lossy(
        &Command::new("git").args(["-C", &repo, "rev-parse", "--abbrev-ref", "HEAD"]).output().await.unwrap().stdout
    ).trim().to_string();

    let mut push_target = remote_name.clone();
    if let Some(t) = token {
        if let Ok(fetch_url) = git_cmd_cached(&repo, &["remote", "get-url", &remote_name]).await {
            let fetch_url = fetch_url.trim();
            if fetch_url.starts_with("https://") {
                if let Ok(mut u) = url::Url::parse(fetch_url) {
                    let _ = u.set_username("token");
                    let _ = u.set_password(Some(&t));
                    push_target = u.to_string();
                }
            }
        }
    }

    let result = tokio::time::timeout(std::time::Duration::from_secs(120), tokio::task::spawn_blocking(move || {
        StdCommand::new("git")
            .args(["-C", &repo, "push", "-u", &push_target, &branch, "--progress", "--no-verify"])
            .output()
    })).await;

    let output = match result {
        Ok(Ok(Ok(out))) => out,
        Ok(Ok(Err(e))) => { return Err(format!("执行失败: {}", e)) }
        Ok(Err(_)) => { return Err("线程错误".into()) }
        Err(_) => { return Err("推送超时(120s)".into()) }
    };

    if output.status.success() {
        Ok(serde_json::json!({ "success": true }))
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(if err.is_empty() { "推送失败，远程仓库拒绝".into() } else { err.to_string() })
    }
}

#[tauri::command]
async fn git_pull(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["pull"]).await?;
    Ok(serde_json::json!({ "success": true }))
}

// ============== Branches / Tags / Stash / History / Diff / GC / Clean / Discard ==============
macro_rules! git_json_cmd {
    ($name:ident, $args:expr, $key:expr) => {
        #[tauri::command]
        async fn $name(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
            let repo = get_repo(&state)?;
            let out = git_cmd_cached(&repo, $args).await?;
            let items: Vec<&str> = out.lines().filter(|l| !l.is_empty()).collect();
            Ok(serde_json::json!({ $key: items }))
        }
    };
}

git_json_cmd!(git_branches, &["branch", "--format=%(refname:short)"], "branches");

#[tauri::command]
async fn git_checkout(name: String, create_new: bool, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    if create_new { git_cmd_cached(&repo, &["checkout", "-b", &name]).await?; }
    else { git_cmd_cached(&repo, &["checkout", &name]).await?; }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_delete_branch(name: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["branch", "-d", &name]).await?;
    Ok(serde_json::json!({ "success": true }))
}

git_json_cmd!(git_tags, &["tag", "--list"], "tags");

#[tauri::command]
async fn git_tag_create(name: String, message: Option<String>, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let msg = message.unwrap_or_default();
    git_cmd_cached(&repo, &["tag", "-a", &name, "-m", &msg]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_tag_delete(name: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["tag", "-d", &name]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_stash(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["stash"]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_stash_pop(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["stash", "pop"]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_stash_list(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let out = git_cmd_cached(&repo, &["stash", "list", "--format=%H||%s||%aI"]).await?;
    let stashes: Vec<serde_json::Value> = out.lines().filter(|l| !l.is_empty()).map(|l| {
        let parts: Vec<&str> = l.split("||").collect();
        serde_json::json!({
            "hash": parts.get(0).unwrap_or(&""),
            "message": parts.get(1).unwrap_or(&""),
            "date": parts.get(2).unwrap_or(&"")
        })
    }).collect();
    Ok(serde_json::json!({ "stashes": stashes }))
}

#[tauri::command]
async fn git_stash_apply(index: u32, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["stash", "apply", &format!("stash@{{{}}}", index)]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_stash_drop(index: u32, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["stash", "drop", &format!("stash@{{{}}}", index)]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_history(count: u32, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let out = git_cmd_cached(&repo, &["log", &format!("--max-count={}", count), "--format=%H||%s||%an||%ae||%aI"]).await?;
    let log: Vec<serde_json::Value> = out.lines().filter(|l| !l.is_empty()).map(|l| {
        let parts: Vec<&str> = l.split("||").collect();
        serde_json::json!({
            "hash": parts[0], "message": parts.get(1).unwrap_or(&""),
            "author_name": parts.get(2).unwrap_or(&""), "author_email": parts.get(3).unwrap_or(&""),
            "date": parts.get(4).unwrap_or(&"")
        })
    }).collect();
    Ok(serde_json::json!({ "log": log }))
}

#[tauri::command]
async fn git_diff(file: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let out = git_cmd_cached(&repo, &["diff", "--", &file]).await?;
    Ok(serde_json::json!({ "diff": out }))
}

#[tauri::command]
async fn git_diff_staged(file: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let out = git_cmd_cached(&repo, &["diff", "--cached", "--", &file]).await?;
    Ok(serde_json::json!({ "diff": out }))
}

#[tauri::command]
async fn git_reset(commit_hash: String, mode: Option<String>, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let m = mode.unwrap_or("--soft".into());
    git_cmd_cached(&repo, &["reset", &m, &commit_hash]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_revert(commit_hash: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["revert", &commit_hash, "--no-edit"]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_discard(file: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["checkout", "--", &file]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_run_gc(mode: Option<String>, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let m = mode.unwrap_or("auto".into());
    if m == "deep" { git_cmd_cached(&repo, &["gc", "--aggressive", "--prune=now"]).await?; }
    else { git_cmd_cached(&repo, &["gc", "--auto"]).await?; }
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_run_clean(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    git_cmd_cached(&repo, &["clean", "-fd", "--quiet"]).await?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn git_get_local_config(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let out = git_cmd_cached(&repo, &["config", "--local", "--list"]).await?;
    Ok(serde_json::json!({ "config": out.trim() }))
}

// ============== Auth (Crypto) ==============
use aes_gcm::{Aes256Gcm, KeyInit, aead::Aead, Nonce};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha512;
use rand::Rng;
use base64::Engine;

#[derive(Serialize, Deserialize)]
struct AuthFile { salt: String, iv: String, tag: String, token: String }

fn get_auth_path(repo: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(repo).join(".git-auth")
}

fn fix_nonce(iv: &[u8]) -> [u8; 12] {
    let mut n = [0u8; 12];
    let len = iv.len().min(12);
    n[..len].copy_from_slice(&iv[..len]);
    n
}

fn encrypt_token_sync(token: &str, pin: &str) -> Result<(Vec<u8>, Vec<u8>, Vec<u8>), String> {
    let mut salt = [0u8; 32]; rand::thread_rng().fill(&mut salt);
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha512>(pin.as_bytes(), &salt, 100000, &mut key);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("{:?}", e))?;
    let mut iv = [0u8; 12]; rand::thread_rng().fill(&mut iv);
    let nonce = Nonce::from_slice(&iv);
    let ct = cipher.encrypt(nonce, token.as_bytes()).map_err(|e| format!("{:?}", e))?;
    Ok((salt.to_vec(), iv.to_vec(), ct))
}

fn decrypt_token_sync(data: &AuthFile, pin: &str) -> Result<String, String> {
    let salt = base64::engine::general_purpose::STANDARD.decode(&data.salt).map_err(|e| e.to_string())?;
    let iv = base64::engine::general_purpose::STANDARD.decode(&data.iv).map_err(|e| e.to_string())?;
    let ct = base64::engine::general_purpose::STANDARD.decode(&data.token).map_err(|e| e.to_string())?;
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha512>(pin.as_bytes(), &salt, 100000, &mut key);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| format!("{:?}", e))?;
    let iv_fixed = fix_nonce(&iv);
    let nonce = Nonce::from_slice(&iv_fixed);
    cipher.decrypt(nonce, ct.as_ref()).map(|v| String::from_utf8_lossy(&v).to_string()).map_err(|_| "PIN 错误".into())
}

#[tauri::command]
async fn auth_save_token(token: String, pin: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let path = get_auth_path(&repo);
    let (salt, iv, ct) = tokio::task::spawn_blocking(move || encrypt_token_sync(&token, &pin)).await.map_err(|e| e.to_string())??;
    let data = AuthFile {
        salt: base64::engine::general_purpose::STANDARD.encode(&salt),
        iv: base64::engine::general_purpose::STANDARD.encode(&iv),
        tag: String::new(),
        token: base64::engine::general_purpose::STANDARD.encode(&ct),
    };
    std::fs::write(&path, serde_json::to_string(&data).unwrap()).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn auth_load_token(pin: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let path = get_auth_path(&repo);
    if !path.exists() { return Err("未找到加密文件".into()) }
    let data: AuthFile = serde_json::from_str(&std::fs::read_to_string(&path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let token = tokio::task::spawn_blocking(move || decrypt_token_sync(&data, &pin)).await.map_err(|e| e.to_string())??;
    Ok(serde_json::json!({ "token": token }))
}

#[tauri::command]
async fn auth_has_token(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    Ok(serde_json::json!({ "exists": get_auth_path(&repo).exists() }))
}

#[tauri::command]
async fn auth_remove_token_file(state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let _ = std::fs::remove_file(get_auth_path(&repo));
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn auth_change_pin(old_pin: String, new_pin: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let path = get_auth_path(&repo);
    let data: AuthFile = serde_json::from_str(&std::fs::read_to_string(&path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let token = { let data = data; tokio::task::spawn_blocking(move || decrypt_token_sync(&data, &old_pin)).await.map_err(|e| e.to_string())?? };
    let (salt, iv, ct) = tokio::task::spawn_blocking(move || encrypt_token_sync(&token, &new_pin)).await.map_err(|e| e.to_string())??;
    let new_data = AuthFile {
        salt: base64::engine::general_purpose::STANDARD.encode(&salt),
        iv: base64::engine::general_purpose::STANDARD.encode(&iv),
        tag: String::new(),
        token: base64::engine::general_purpose::STANDARD.encode(&ct),
    };
    std::fs::write(&path, serde_json::to_string(&new_data).unwrap()).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn auth_verify_pin(pin: String, state: State<'_, RepoState>) -> Result<serde_json::Value, String> {
    let repo = get_repo(&state)?;
    let path = get_auth_path(&repo);
    if !path.exists() { return Ok(serde_json::json!({ "valid": false })) }
    let data: AuthFile = serde_json::from_str(&std::fs::read_to_string(&path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let valid = tokio::task::spawn_blocking(move || decrypt_token_sync(&data, &pin).is_ok()).await.map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "valid": valid }))
}

// ============== Recent Projects ==============
fn recents_path() -> std::path::PathBuf {
    dirs_sys_path().unwrap_or_default().join("recent-projects.json")
}

fn dirs_sys_path() -> Option<std::path::PathBuf> {
    std::env::var("APPDATA").ok().map(|p| std::path::PathBuf::from(p).join("git-desktop-gui"))
}

fn save_recent(dir: &str) {
    let path = recents_path();
    let mut list: Vec<String> = std::fs::read_to_string(&path).ok()
        .and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    list.retain(|p| p != dir);
    list.insert(0, dir.to_string());
    list.truncate(10);
    let _ = std::fs::write(&path, serde_json::to_string(&list).unwrap());
}

#[tauri::command]
async fn recent_list() -> Result<serde_json::Value, String> {
    let list: Vec<String> = std::fs::read_to_string(recents_path()).ok()
        .and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    Ok(serde_json::json!({ "projects": list }))
}

#[tauri::command]
async fn recent_remove(dir: String) -> Result<serde_json::Value, String> {
    let path = recents_path();
    let mut list: Vec<String> = std::fs::read_to_string(&path).ok()
        .and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
    list.retain(|p| p != &dir);
    let _ = std::fs::write(&path, serde_json::to_string(&list).unwrap());
    Ok(serde_json::json!({ "success": true }))
}

// ============== App Info ==============
#[tauri::command]
async fn app_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "version": "1.4.23", "name": "Git-Desktop-GUI",
        "repo": "https://github.com/cnsuiyue/git-desktop-gui"
    }))
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

// ============== Main ==============
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(RepoState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_repo, git_status, git_stage, git_unstage, git_stage_all, git_commit,
            git_history, git_diff, git_diff_staged, git_reset, git_revert,
            git_branches, git_checkout, git_delete_branch,
            git_pull, git_push,
            git_stash, git_stash_pop, git_stash_list, git_stash_apply, git_stash_drop,
            git_discard, git_get_remotes, git_set_remote, git_remove_remote,
            git_run_gc, git_run_clean, git_get_global_config, git_set_global_config, git_get_local_config,
            git_tags, git_tag_create, git_tag_delete,
            auth_save_token, auth_load_token, auth_has_token, auth_remove_token_file, auth_change_pin, auth_verify_pin,
            recent_list, recent_remove, app_info, open_url
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            
            let window = app.get_webview_window("main").unwrap();
            window.show().unwrap();
            window.set_focus().unwrap();
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error");
}