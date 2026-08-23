# ClipForge

**ClipForge** is a modern, open-source media conversion web application built with **Next.js, Node.js, Express, TypeScript, and FFmpeg**.

It provides a clean and simple way to process media files and convert them into different formats without confusing interfaces, fake download buttons, or unnecessary complexity.

The project is currently under active development.

---

## ✨ Overview

ClipForge is being built as a full-stack media processing platform.

The current backend can:

* Upload media files
* Process files using FFmpeg
* Extract audio from video
* Convert media to MP3
* Return the converted file as a download
* Automatically remove temporary input and output files after processing

The frontend is built with Next.js and will provide a modern browser interface for uploading, converting, and downloading media.

---

## 🚀 Current Status

### Working

* [x] GitHub repository setup
* [x] Next.js frontend project
* [x] Express backend API
* [x] TypeScript support
* [x] CORS configuration
* [x] Media file uploads with Multer
* [x] FFmpeg integration
* [x] FFprobe installation
* [x] MP4/video to MP3 conversion
* [x] 192 kbps MP3 encoding
* [x] Temporary upload storage
* [x] Automatic temporary file cleanup
* [x] API health endpoint
* [x] File download response

### In Progress

* [ ] ClipForge frontend interface
* [ ] Frontend-to-backend integration
* [ ] Drag-and-drop uploads
* [ ] Upload progress
* [ ] Conversion progress
* [ ] Better validation and error handling

---

## 🛠️ Tech Stack

### Frontend

* **Next.js**
* **React**
* **TypeScript**
* **Tailwind CSS**

### Backend

* **Node.js**
* **Express**
* **TypeScript**
* **Multer**

### Media Processing

* **FFmpeg**
* **FFprobe**
* **libmp3lame**

### Development

* **npm**
* **Git**
* **GitHub**
* **tsx**

---

## 🏗️ Architecture

The current ClipForge architecture is intentionally simple while the core media engine is being developed.

```text
┌──────────────────────────────┐
│                              │
│       Next.js Frontend       │
│      localhost:3000          │
│                              │
└──────────────┬───────────────┘
               │
               │ HTTP / REST
               ▼
┌──────────────────────────────┐
│                              │
│      Express REST API        │
│      localhost:5000          │
│                              │
└──────────────┬───────────────┘
               │
               │ Media Upload
               ▼
┌──────────────────────────────┐
│                              │
│           Multer             │
│     Temporary Storage        │
│                              │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│                              │
│           FFmpeg             │
│      Media Processing        │
│                              │
└──────────────┬───────────────┘
               │
               │ Converted File
               ▼
┌──────────────────────────────┐
│                              │
│       Express Download       │
│                              │
└──────────────┬───────────────┘
               │
               ▼
           User Device
```

After the download completes, temporary media files are removed from the server.

---

## 📁 Project Structure

```text
clipforge/
│
├── apps/
│   │
│   ├── api/
│   │   ├── src/
│   │   │   ├── services/
│   │   │   │   └── ffmpeg.ts
│   │   │   └── app.ts
│   │   │
│   │   ├── storage/
│   │   │   ├── uploads/
│   │   │   └── output/
│   │   │
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/
│       ├── src/
│       │   └── app/
│       │       ├── page.tsx
│       │       ├── layout.tsx
│       │       └── globals.css
│       │
│       └── package.json
│
├── .gitignore
└── README.md
```

The `storage` directories are used only for temporary media processing and should not be committed to Git.

---

# ⚙️ Getting Started

## Prerequisites

Before running ClipForge locally, make sure the following software is installed:

* Node.js
* npm
* Git
* FFmpeg
* FFprobe

Recommended Node.js version:

```text
Node.js 22+
```

Check Node.js:

```bash
node --version
```

Check npm:

```bash
npm --version
```

Check Git:

```bash
git --version
```

Check FFmpeg:

```bash
ffmpeg -version
```

Check FFprobe:

```bash
ffprobe -version
```

---

# 📥 Installation

Clone the repository:

```bash
git clone https://github.com/janithcd/clipforge.git
```

Enter the project:

```bash
cd clipforge
```

---

## Install Frontend Dependencies

```bash
cd apps/web
npm install
```

---

## Install Backend Dependencies

From the repository root:

```bash
cd apps/api
npm install
```

---

# 🎞️ Installing FFmpeg

ClipForge requires FFmpeg to process media.

### Windows

FFmpeg can be installed with WinGet:

```powershell
winget install --id Gyan.FFmpeg -e
```

After installation, restart your terminal.

Check that FFmpeg is available:

```powershell
ffmpeg -version
```

Then verify FFprobe:

```powershell
ffprobe -version
```

Both commands should return version information.

If Windows cannot locate FFmpeg after installation, make sure the FFmpeg `bin` directory is included in your system or user `PATH`.

---

# ▶️ Running ClipForge

ClipForge currently requires two development servers.

## Start the Backend API

Open a terminal:

```bash
cd apps/api
npm run dev
```

The API should start at:

```text
http://localhost:5000
```

You should see:

```text
ClipForge API running at http://localhost:5000
```

---

## Start the Frontend

Open another terminal:

```bash
cd apps/web
npm run dev
```

The frontend should be available at:

```text
http://localhost:3000
```

---

# ❤️ Health Check

Check whether the API is running:

```http
GET /api/health
```

Example:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "ClipForge API is healthy"
}
```

---

# 🎵 MP3 Conversion API

ClipForge currently provides an endpoint for extracting audio from uploaded media and converting it to MP3.

## Endpoint

```http
POST /api/convert/mp3
```

### Request Type

```text
multipart/form-data
```

### Form Field

```text
file
```

### Example using cURL

```bash
curl -X POST \
  -F "file=@test-video.mp4" \
  http://localhost:5000/api/convert/mp3 \
  --output converted.mp3
```

### PowerShell

On Windows PowerShell, use `curl.exe`:

```powershell
curl.exe -X POST `
  -F "file=@C:\path\to\video.mp4" `
  http://localhost:5000/api/convert/mp3 `
  --output "C:\path\to\converted.mp3"
```

---

## Conversion Pipeline

When a media file is submitted:

```text
Media File
    │
    ▼
Upload
    │
    ▼
Multer
    │
    ▼
Temporary Storage
    │
    ▼
FFmpeg
    │
    ├── Remove video stream
    │
    ├── Extract audio
    │
    └── Encode with libmp3lame
    │
    ▼
MP3 • 192 kbps
    │
    ▼
Express Download
    │
    ▼
Client
    │
    ▼
Temporary Files Deleted
```

The current FFmpeg conversion uses approximately:

```bash
ffmpeg -i input.mp4 \
  -vn \
  -codec:a libmp3lame \
  -b:a 192k \
  output.mp3
```

---

# 🔐 Temporary File Handling

Uploaded files should not remain permanently on the server.

ClipForge currently uses temporary directories such as:

```text
apps/api/storage/uploads/
apps/api/storage/output/
```

After a successful conversion and download, the application removes both:

```text
Original temporary upload
Converted temporary output
```

These directories are excluded from Git through `.gitignore`.

---

# 📏 Current Upload Limit

The current API allows individual uploaded files up to approximately:

```text
500 MB
```

This limit is intended for development and may be adjusted before production deployment.

Production deployments will require additional controls such as:

* Authentication or rate limiting
* File type validation
* File size restrictions
* Request throttling
* Storage quotas
* Abuse prevention
* Conversion time limits

---

# 🗺️ Roadmap

## Phase 1 — Foundation

* [x] Create repository
* [x] Configure Git
* [x] Create Next.js frontend
* [x] Create Express backend
* [x] Configure TypeScript
* [x] Install FFmpeg
* [x] Create health API

---

## Phase 2 — Media Conversion

* [x] Media upload
* [x] MP3 conversion
* [x] FFmpeg integration
* [x] Temporary storage
* [x] Automatic cleanup

Planned:

* [ ] MP3 128 kbps
* [ ] MP3 192 kbps
* [ ] MP3 256 kbps
* [ ] MP3 320 kbps
* [ ] MP4 conversion
* [ ] WebM conversion
* [ ] WAV conversion
* [ ] M4A conversion

---

## Phase 3 — Frontend

* [ ] Modern landing page
* [ ] Drag-and-drop upload
* [ ] File information preview
* [ ] Format selector
* [ ] Quality selector
* [ ] Upload progress
* [ ] Conversion progress
* [ ] Download screen
* [ ] Error notifications
* [ ] Responsive mobile interface
* [ ] Dark mode

---

## Phase 4 — Media Tools

Planned tools include:

* [ ] Audio extraction
* [ ] Video compression
* [ ] Audio compression
* [ ] Video trimming
* [ ] Audio trimming
* [ ] Video resizing
* [ ] Resolution selection
* [ ] Thumbnail extraction
* [ ] Metadata inspection

---

## Phase 5 — Processing Infrastructure

As ClipForge grows, media processing will be separated from the API.

Planned architecture:

```text
Browser
   │
   ▼
Next.js
   │
   ▼
REST API
   │
   ▼
Job Queue
   │
   ▼
Conversion Worker
   │
   ▼
FFmpeg
   │
   ▼
Temporary Object Storage
   │
   ▼
Download
```

Potential technologies:

* Redis
* BullMQ
* Worker processes
* Background processing
* Job status tracking
* Automatic retries

---

## Phase 6 — Docker

Planned Docker architecture:

```text
clipforge-web
clipforge-api
clipforge-worker
redis
```

The project will eventually support:

```bash
docker compose up
```

for local development.

---

## Phase 7 — Cloud Deployment

The long-term infrastructure may use AWS services including:

* Amazon S3
* Amazon ECS
* AWS Fargate
* Amazon CloudFront
* Amazon CloudWatch
* Amazon SQS
* AWS IAM

Possible production architecture:

```text
                        ┌──────────────┐
                        │  CloudFront  │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Frontend   │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │     API      │
                        │ ECS/Fargate  │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Job Queue    │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Workers    │
                        │ ECS/Fargate  │
                        └──────┬───────┘
                               │
                               ▼
                           ┌──────┐
                           │  S3  │
                           └──────┘
```

---

# 🔌 Future Source Integration

ClipForge's conversion engine is designed to remain independent from individual media providers.

Future versions may support:

* Direct media URLs
* User-owned cloud media
* Public-domain media
* Media sources that explicitly permit downloading
* User-authorized integrations

Source-specific functionality should be implemented separately from the core FFmpeg processing engine.

---

# ⚖️ Responsible Use

ClipForge is intended for processing media that users:

* Own
* Created themselves
* Have permission to modify or download
* Have legally obtained
* Are otherwise authorized to process

Users are responsible for ensuring that their use of ClipForge complies with applicable:

* Copyright laws
* Platform terms of service
* Licensing requirements
* Local laws and regulations

ClipForge should not be used to bypass digital rights management, access controls, or other technical restrictions.

---

# 🔒 Security Considerations

Media-processing services can receive untrusted files from users.

Before ClipForge is deployed publicly, additional security measures should be implemented, including:

* MIME type validation
* File extension validation
* Magic-byte inspection
* Filename sanitization
* Maximum upload size enforcement
* Rate limiting
* Conversion timeouts
* CPU and memory limits
* Temporary storage quotas
* Request throttling
* Container isolation
* Automatic file expiry
* Authentication where appropriate
* Logging and monitoring

FFmpeg workers should eventually run inside isolated environments instead of directly within the public API process.

---

# 🌟 Project Goals

ClipForge aims to become a media utility that is:

**Simple**

No confusing workflows.

**Fast**

Efficient media processing powered by FFmpeg.

**Clean**

No fake download buttons or misleading interfaces.

**Modern**

Built with a modern TypeScript full-stack architecture.

**Scalable**

Designed so processing can later move to queues, dedicated workers, containers, and cloud infrastructure.

**Developer Friendly**

Clear project structure, APIs, documentation, and contribution workflow.

---

# 🤝 Contributing

Contributions will be welcome as the project develops.

To contribute:

1. Fork the repository.

2. Create a new branch:

```bash
git switch -c feature/your-feature
```

3. Make your changes.

4. Run the relevant tests and checks.

5. Commit using a clear message:

```bash
git commit -m "feat: add your feature"
```

6. Push your branch:

```bash
git push origin feature/your-feature
```

7. Open a Pull Request.

Examples of useful contribution areas:

* Frontend improvements
* FFmpeg processing
* API development
* Testing
* Accessibility
* Documentation
* Performance
* Security
* Docker
* Cloud infrastructure

---

# 🧑‍💻 Development Workflow

Before committing:

```bash
git status
```

Run TypeScript checks for the API:

```bash
cd apps/api
npm run typecheck
```

Then return to the repository root:

```bash
cd ../..
```

Stage changes:

```bash
git add .
```

Check staged files:

```bash
git status
```

Check for whitespace problems:

```bash
git diff --cached --check
```

Commit:

```bash
git commit -m "feat: describe the change"
```

Push:

```bash
git push
```

---

# 📝 Commit Convention

The project follows clear, descriptive Git commit messages.

Examples:

```text
feat: add MP3 conversion endpoint
fix: clean temporary files after failed conversion
docs: improve setup instructions
refactor: separate FFmpeg conversion service
test: add media conversion tests
chore: update dependencies
```

Recommended prefixes:

| Prefix     | Purpose                   |
| ---------- | ------------------------- |
| `feat`     | New feature               |
| `fix`      | Bug fix                   |
| `docs`     | Documentation             |
| `refactor` | Internal code improvement |
| `test`     | Tests                     |
| `chore`    | Maintenance               |
| `perf`     | Performance improvement   |

---

# 🧪 Testing

Automated tests have not yet been fully implemented.

Future testing will cover:

* API health checks
* Upload validation
* FFmpeg failures
* Successful MP3 conversion
* Invalid file handling
* Maximum file sizes
* Temporary file cleanup
* API error responses
* Frontend interactions

---

# 📊 Planned API Structure

As ClipForge grows, endpoints may follow a structure similar to:

```text
GET    /api/health

POST   /api/convert/mp3
POST   /api/convert/mp4
POST   /api/convert/wav
POST   /api/convert/webm

POST   /api/jobs
GET    /api/jobs/:id
DELETE /api/jobs/:id
```

The API design may change while the project is under active development.

---

# 📌 Development Status

ClipForge is currently an **early-stage development project**.

The core proof of concept is working:

```text
Upload video
      ↓
Express API
      ↓
FFmpeg
      ↓
Extract audio
      ↓
Encode MP3
      ↓
Download
```

The next major milestone is building the complete browser-based conversion interface.

---

# 👨‍💻 Author

**Janith Dasanayaka**

GitHub: [@janithcd](https://github.com/janithcd)

Repository:

[github.com/janithcd/clipforge](https://github.com/janithcd/clipforge)

---

## ⭐ Support

If you find ClipForge useful or are interested in its development, consider giving the repository a star.

---

<p align="center">
  <strong>ClipForge</strong><br>
  Convert media. Fast, clean, and simple.
</p>
