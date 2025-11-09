# Tool Installation Guide

Complete guide for installing all required tools and dependencies for the DigitWin Live development environment.

## Table of Contents

- [Core Development Tools](#core-development-tools)
- [Database](#database)
- [Infrastructure Tools](#infrastructure-tools)
- [Optional Tools](#optional-tools)
- [Platform-Specific Instructions](#platform-specific-instructions)
- [Verification](#verification)

---

## Core Development Tools

### 1. Node.js (v18+)

Node.js is required for running the application and build tools.

#### macOS

**Using Homebrew:**

```bash
brew install node@20
```

**Using nvm (recommended):**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal, then:
nvm install 20
nvm use 20
nvm alias default 20
```

#### Linux (Ubuntu/Debian)

**Using NodeSource:**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Using nvm (recommended):**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

#### Windows

**Using Installer:**

1. Download from [nodejs.org](https://nodejs.org/)
2. Run the installer
3. Restart terminal

**Using Chocolatey:**

```powershell
choco install nodejs-lts
```

**Verify Installation:**

```bash
node --version  # Should show v20.x.x or v18.x.x
npm --version   # Should show 9.x.x or higher
```

---

### 2. pnpm (v8+)

pnpm is the package manager used for this monorepo.

#### All Platforms

**Using npm:**

```bash
npm install -g pnpm@8
```

**Using Homebrew (macOS):**

```bash
brew install pnpm
```

**Using Corepack (recommended):**

```bash
corepack enable
corepack prepare pnpm@8.10.0 --activate
```

**Verify Installation:**

```bash
pnpm --version  # Should show 8.x.x
```

---

### 3. Git

Git is required for version control.

#### macOS

**Using Homebrew:**

```bash
brew install git
```

**Using Xcode Command Line Tools:**

```bash
xcode-select --install
```

#### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install git
```

#### Windows

**Using Installer:**

1. Download from [git-scm.com](https://git-scm.com/)
2. Run the installer

**Using Chocolatey:**

```powershell
choco install git
```

**Verify Installation:**

```bash
git --version  # Should show 2.x.x
```

---

## Database

### PostgreSQL 15+

PostgreSQL is the primary database for the application.

#### macOS

**Using Homebrew:**

```bash
# Install PostgreSQL
brew install postgresql@17

# Start PostgreSQL service
brew services start postgresql@17

# Add to PATH
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Using Postgres.app:**

1. Download from [postgresapp.com](https://postgresapp.com/)
2. Drag to Applications
3. Open and initialize

#### Linux (Ubuntu/Debian)

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql-15 postgresql-contrib-15

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows

**Using Installer:**

1. Download from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Run the installer
3. Remember the password you set for the postgres user

**Using Chocolatey:**

```powershell
choco install postgresql15
```

**Verify Installation:**

```bash
psql --version  # Should show 15.x
pg_isready      # Should show "accepting connections"
```

**Create Development Database:**

```bash
# Create database
createdb digitwin_live_dev

# Or using psql
psql -U postgres -c "CREATE DATABASE digitwin_live_dev;"
```

---

## Infrastructure Tools

### Terraform (v1.5+)

Terraform is used for infrastructure as code (GCP deployment).

#### macOS

**Using Homebrew:**

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

#### Linux (Ubuntu/Debian)

```bash
# Add HashiCorp GPG key
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg

# Add repository
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list

# Install Terraform
sudo apt-get update
sudo apt-get install terraform
```

#### Windows

**Using Chocolatey:**

```powershell
choco install terraform
```

**Using Installer:**

1. Download from [terraform.io](https://www.terraform.io/downloads)
2. Extract and add to PATH

**Verify Installation:**

```bash
terraform version  # Should show v1.5.x or higher
```

---

### Google Cloud SDK (gcloud)

Required for GCP infrastructure deployment.

#### macOS

**Using Homebrew:**

```bash
brew install google-cloud-sdk
```

**Using Installer:**

```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

#### Linux

```bash
# Add Cloud SDK repository
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

# Import Google Cloud public key
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -

# Install
sudo apt-get update
sudo apt-get install google-cloud-sdk
```

#### Windows

**Using Installer:**

1. Download from [cloud.google.com/sdk](https://cloud.google.com/sdk/docs/install)
2. Run the installer

**Verify Installation:**

```bash
gcloud version  # Should show Google Cloud SDK version
```

**Initialize gcloud:**

```bash
gcloud init
gcloud auth application-default login
```

---

## Optional Tools

### Docker (for containerized services)

#### macOS

**Using Homebrew:**

```bash
brew install --cask docker
```

**Using Installer:**

1. Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)
2. Install and start Docker Desktop

#### Linux (Ubuntu/Debian)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

#### Windows

1. Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)
2. Install and restart

**Verify Installation:**

```bash
docker --version
docker-compose --version
```

---

---

**Note:** This project uses **PostgreSQL indexed cache tables** for caching instead of Redis. No separate caching service is required. See [Caching Architecture](./CACHING-ARCHITECTURE.md) for details.

---

## Platform-Specific Instructions

### macOS Setup

Complete setup for macOS:

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install all tools
brew install node@20 pnpm git postgresql@17 terraform google-cloud-sdk

# Start services
brew services start postgresql@17

# Verify installations
node --version
pnpm --version
git --version
psql --version
terraform version
gcloud version
```

---

### Linux (Ubuntu/Debian) Setup

Complete setup for Ubuntu/Debian:

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm@8

# Install Git
sudo apt-get install git

# Install PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install postgresql-15

# Install Terraform
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt-get update
sudo apt-get install terraform

# Install Google Cloud SDK
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
sudo apt-get update
sudo apt-get install google-cloud-sdk

# Start services
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installations
node --version
pnpm --version
git --version
psql --version
terraform version
gcloud version
```

---

### Windows Setup (WSL Recommended)

For Windows, we recommend using WSL2 (Windows Subsystem for Linux):

**1. Install WSL2:**

```powershell
# Run in PowerShell as Administrator
wsl --install
```

**2. Install Ubuntu from Microsoft Store**

**3. Follow Linux setup instructions inside WSL**

**Alternative: Native Windows Setup**

```powershell
# Using Chocolatey (run PowerShell as Administrator)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install tools
choco install nodejs-lts pnpm git postgresql15 terraform gcloudsdk
```

---

## Verification

After installing all tools, verify your setup:

```bash
# Create verification script
cat > verify-setup.sh << 'EOF'
#!/bin/bash

echo "Verifying development environment setup..."
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo "✓ Node.js: $(node --version)"
else
    echo "✗ Node.js: NOT INSTALLED"
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    echo "✓ pnpm: $(pnpm --version)"
else
    echo "✗ pnpm: NOT INSTALLED"
fi

# Check Git
if command -v git &> /dev/null; then
    echo "✓ Git: $(git --version)"
else
    echo "✗ Git: NOT INSTALLED"
fi

# Check PostgreSQL
if command -v psql &> /dev/null; then
    echo "✓ PostgreSQL: $(psql --version)"
else
    echo "✗ PostgreSQL: NOT INSTALLED"
fi

# Check Terraform
if command -v terraform &> /dev/null; then
    echo "✓ Terraform: $(terraform version | head -1)"
else
    echo "✗ Terraform: NOT INSTALLED (optional for infrastructure)"
fi

# Check gcloud
if command -v gcloud &> /dev/null; then
    echo "✓ Google Cloud SDK: $(gcloud version | head -1)"
else
    echo "✗ Google Cloud SDK: NOT INSTALLED (optional for infrastructure)"
fi

# Check PostgreSQL connection
if pg_isready &> /dev/null; then
    echo "✓ PostgreSQL: RUNNING"
else
    echo "✗ PostgreSQL: NOT RUNNING"
fi

echo ""
echo "Verification complete!"
EOF

chmod +x verify-setup.sh
./verify-setup.sh
```

**Expected Output:**

```
✓ Node.js: v20.x.x
✓ pnpm: 8.x.x
✓ Git: git version 2.x.x
✓ PostgreSQL: psql (PostgreSQL) 15.x
✓ Terraform: Terraform v1.5.x
✓ Google Cloud SDK: Google Cloud SDK 450.x.x
✓ PostgreSQL: RUNNING
```

---

## Next Steps

After installing all tools:

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd digitwinlive
   ```

2. **Follow the Getting Started guide:**
   - [Getting Started](./GETTING-STARTED.md)
   - [Environment Setup](./ENVIRONMENT-SETUP.md)

3. **For infrastructure deployment:**
   - [GCP Infrastructure Setup](./GCP-INFRASTRUCTURE.md)
   - [Infrastructure Setup Guide](../infrastructure/SETUP-GUIDE.md)

---

## Troubleshooting

### Node.js Version Issues

```bash
# Check current version
node --version

# If using nvm, switch version
nvm use 20

# Set default version
nvm alias default 20
```

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS)
brew services start postgresql@17

# Start PostgreSQL (Linux)
sudo systemctl start postgresql

# Check PostgreSQL status
brew services list  # macOS
sudo systemctl status postgresql  # Linux
```

### Permission Issues

```bash
# Fix npm global permissions (Linux/macOS)
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Fix PostgreSQL permissions
sudo -u postgres createuser -s $USER
```

### PATH Issues

```bash
# Add to PATH (macOS/Linux)
echo 'export PATH="/path/to/tool/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc
source ~/.zshrc  # or source ~/.bashrc

# Verify PATH
echo $PATH
```

---

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [pnpm Documentation](https://pnpm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [Google Cloud SDK Documentation](https://cloud.google.com/sdk/docs)
- [Docker Documentation](https://docs.docker.com/)

---

## Support

If you encounter issues during installation:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review platform-specific documentation
3. Search for error messages online
4. Contact the development team
