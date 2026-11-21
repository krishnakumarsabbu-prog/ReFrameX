# ReframeX — Setup Instructions

## Prerequisites

- Node.js 18+ and npm
- Python 3.11+

## Backend setup

```bash
cd backend
pip install -r requirements.txt
```

### Run the backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The API is available at `http://127.0.0.1:8000`. Interactive docs at `/docs`.

### Configure the metadata folder (optional)

To use the "Import metadata folder" feature:

```bash
export M2O_METADATA_DIR="/path/to/M2O Hackathon Metadata"
```

Then restart the backend. The importer reads this folder read-only.

### Run backend tests

```bash
cd backend
pip install pytest httpx
python -m pytest tests/ -v
```

## Frontend setup

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` calls to the
backend at `http://127.0.0.1:8000`. Both must be running simultaneously.

### Production build

```bash
npm run build
```

## Using the application

1. Start the backend and frontend in separate terminals.
2. Open `http://localhost:5173` in your browser.
3. Go to **Applications** — create a new application (name, owner, domain, etc.).
4. Set an application as active by clicking the check icon on its card.
5. Go to **Artifact Explorer** — upload files, a folder, or import from the
   configured metadata folder.
6. Review the inventory table: category, support level, encoding, size.
7. Click any artifact to view its content and metadata in a side drawer.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check + metadata dir status |
| GET | `/api/applications` | List all applications |
| POST | `/api/applications` | Create application |
| GET | `/api/applications/{id}` | Get application detail |
| PUT | `/api/applications/{id}` | Update application |
| DELETE | `/api/applications/{id}` | Delete application (+ artifacts) |
| GET | `/api/applications/{id}/artifacts` | List artifacts |
| POST | `/api/applications/{id}/artifacts` | Upload files (multi-file / folder) |
| POST | `/api/applications/{id}/artifacts/import-folder` | Import from M2O_METADATA_DIR |
| GET | `/api/applications/{id}/artifacts/summary` | Counts by category / support / encoding |
| GET | `/api/artifacts/{id}` | Get artifact detail |
| GET | `/api/artifacts/{id}/content` | Get artifact content (text only) |
| DELETE | `/api/artifacts/{id}` | Delete artifact |

## Data storage

- SQLite database: `backend/reframex.db`
- Uploaded files: `backend/uploads/{application_id}/`
- Originals are stored read-only and never modified.

## Sample data

Sample mainframe artifacts for testing are in `backend/sample_data/`:
COBOL program, copybook, JCL, SQL DDL, and BMS map.

To test the folder importer without the real metadata folder, point
`M2O_METADATA_DIR` at `backend/sample_data/`:

```bash
export M2O_METADATA_DIR="$(pwd)/backend/sample_data"
```
