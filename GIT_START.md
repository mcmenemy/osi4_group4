# Getting Started

You need three things to get set up:

1. An SSH key on your GitHub account
2. A copy of this repo, cloned over SSH
3. Claude Code, opened in the repo

Pick the instructions for your OS below. You'll need a [GitHub account](https://github.com/signup), plus [Git](https://git-scm.com/downloads) installed. Macs usually have Git already. Run `git --version` in Terminal to check, and accept the prompt to install the Command Line Tools if it appears. On Windows, install [Git for Windows](https://git-scm.com/downloads/win), which also includes **Git Bash**.

---

## macOS

All commands go in **Terminal**.

### 1. Create an SSH key

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Press Enter to accept the default location (`~/.ssh/id_ed25519`). A passphrase is optional but recommended.

### 2. Add the key to the ssh-agent

```bash
eval "$(ssh-agent -s)"
```

Create or edit `~/.ssh/config` so macOS remembers the key:

```bash
touch ~/.ssh/config
open -e ~/.ssh/config
```

Add these lines and save:

```
Host github.com
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
```

Then add the key (this saves the passphrase in your Keychain):

```bash
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

### 3. Add the key to GitHub

Copy the **public** key to your clipboard:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

On GitHub, open **Settings → SSH and GPG keys → New SSH key**, give it a title (for example, "My MacBook"), paste the key, and click **Add SSH key**.

Test the connection:

```bash
ssh -T git@github.com
```

Type `yes` if it asks about the host fingerprint. You should see `Hi <username>! You've successfully authenticated...`.

### 4. Clone the repo via SSH

```bash
git clone git@github.com:mcmenemy/osi4_group4.git
cd osi4_group4
```

### 5. Install Claude Code and open the repo

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

(Or, with Homebrew: `brew install --cask claude-code`.)

From inside the `osi4_group4` folder, start Claude Code:

```bash
claude
```

The first time you run it, it will ask you to log in with your Claude account.

---

## Windows

Run steps 1–4 in **Git Bash** (installed with Git for Windows). Run step 5 in **PowerShell**.

### 1. Create an SSH key

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Press Enter to accept the default location (`/c/Users/<you>/.ssh/id_ed25519`). A passphrase is optional but recommended.

### 2. Add the key to the ssh-agent

```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

### 3. Add the key to GitHub

Copy the **public** key to your clipboard:

```bash
clip < ~/.ssh/id_ed25519.pub
```

On GitHub, open **Settings → SSH and GPG keys → New SSH key**, give it a title (for example, "My Windows PC"), paste the key, and click **Add SSH key**.

Test the connection:

```bash
ssh -T git@github.com
```

Type `yes` if it asks about the host fingerprint. You should see `Hi <username>! You've successfully authenticated...`.

### 4. Clone the repo via SSH

```bash
git clone git@github.com:mcmenemy/osi4_group4.git
cd osi4_group4
```

### 5. Install Claude Code and open the repo

In **PowerShell**:

```powershell
irm https://claude.ai/install.ps1 | iex
```

(Or, with WinGet: `winget install Anthropic.ClaudeCode`.)

Open a new terminal, go to the repo folder, and start Claude Code:

```powershell
cd $HOME\osi4_group4
claude
```

(Change the path if you cloned the repo somewhere else.) The first time you run it, it will ask you to log in with your Claude account.

---

## Troubleshooting

- **`Permission denied (publickey)`**: the key isn't on GitHub or isn't loaded. Run `ssh-add -l` to see which keys are loaded, then repeat steps 2–3.
- **`claude: command not found`**: close and reopen your terminal so it picks up the updated `PATH`, then try again.
