## Spec: `spin up` command

### 1. Purpose

* A single “up” command that will:

  1. Load your CLI‐wide config (`~/.spin/config.json`)
  2. Discover existing “Spin” accounts via DynamoDB tables tagged `spin-cli`
  3. and give option of "Create New" at the end of the list, this will internally run `spin init` (so `up` auto‐bootstraps)
  4. Prompt to select one of the discovered accounts
  5. Save the chosen account back into `~/.spin/config.json`
  6. (Placeholder) Begin your deploy flow (S3 sync, CloudFront invalidation, etc.)

### 2. Tech stack

* **CLI framework**: [Commander](https://github.com/tj/commander.js)
* **Prompts**: [Enquirer](https://github.com/enquirer/enquirer)
* **Output styling**: [Chalk](https://github.com/chalk/chalk)
* **AWS SDK**: v3, modular imports for DynamoDB

### 3. Directory structure

```
project-root/
└── src/
    └── cli/
        ├── index.ts          # entry-point: sets up Commander and registers commands
        └── commands/
            └── up.ts         # implementation of `spin up`
```

### 4. Config file format (`~/.spin/config.json`)

```json
{
  "accounts": [
    { "name": "prod", "tableName": "SpinTableProd", defaultRegion: "us-east-1" },
    { "name": "staging", "tableName": "SpinTableStaging", defaultRegion: "us-east-1" }
  ],
  "defaultAccount": "staging"
}
```

### 5. Runtime behavior

When user runs:

```bash
$ spin up 
```

1. **Load** `~/.spin/config.json` (or create an empty skeleton if missing).
2. **List** all DynamoDB tables in `AWS_REGION` (default in env variable).
3. **Filter** those tagged `spin-cli`.
4. **If none**, prompt (`Create new Spin account?`) → invoke `spin init` and exit.
5. **Else**, prompt (`Select Spin account:`) with Enquirer.
6. **Persist** the choice in config.
7. **Log** “Using account: X”
8. **(Stub)** “Deploying project…”

Global flags:

* `--profile, -p` → AWS profile
* `--region,  -r` → AWS region (default `us-east-1`)
* `--yes,     -y` → skip any confirmations
* `--help,    -h` → show help

---

## Dev Tasks & Acceptance Criteria

|  #  | Task                                                                                                                     | AC                                                                                                              |
| :-: | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
|  2  | **Entry point** (`src/cli/index.ts`)<br>• Initialize Commander<br>• Register `up` command                                | - Running `spin --help` shows `up` in command list<br>- `spin up -h` prints usage for `up`                      |
|  3  | **Stub command** (`src/cli/commands/up.ts`)<br>• Skeleton that logs “spin up invoked”                                    | - `spin up` prints a colored message: “spin up invoked” (via Chalk)                                             |
|  4  | **Config load/save**<br>• Read/write `~/.spin/config.json`<br>• Create dir/file if missing                               | - First run creates `~/.spin/config.json`<br>- Subsequent runs read and write `./.spin/config.json`                   |
|  5  | **DynamoDB discovery**<br>• ListTables + ListTagsOfResource<br>• Filter tag `spin-cli`                                   | - When 0 tables tagged → in-memory list is empty<br>- When tables exist → list contains their names             |
|  6  | **“No accounts” flow**<br>• Enquirer confirm “Create new Spin account?”<br>• On “yes”, invoke Commander’s `init`         | - If no tables and user answers “no” → exit with code 1<br>- If “yes” → `spin init` is called and process exits |
|  7  | **Account selection**<br>• Enquirer select from found tables<br>• Set `./.spin/config.json`                                    | - a selection prompt appears<br>- On choose, config file’s `./.spin/config.json` updates   |
|  8  | **Persist selection**<br>• Write updated config back to disk                                                             | - After selection, `~/.spin/config.json` reflects into `./.spin/config.json`                                           |
|  9  | **Deploy stub**<br>• After account logic, log “Deploying project (TODO…)”                                                | - `spin up` ends by printing a green “Deploying project…” message                                               |

---

With these specs and tasks, a developer can pick each card in order and implement incrementally. Let me know which task you’d like to start with—this incremental approach will keep us on track!
