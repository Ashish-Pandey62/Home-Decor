# Home Decor Advisor

A full-stack AI-powered application to help you visualize and plan your home decor! Upload your room images, experiment with wall paints, wallpapers and get smart suggestions for your space. Built with FastAPI (backend) and React + Vite (frontend).

---

## Features

- **Room Image Upload:** Upload images of your room and get them processed instantly.
- **AI Wall Detection:** Detects walls in your room using deep learning models (SAM, DPT-Swin2).
- **Virtual Wall Painting:** Try out different wall paint colors and wallpapers virtually.
- **Smart Suggestions:** Get AI-powered decor suggestions tailored to your room.
- **Modern UI:** Fast, responsive, and beautiful frontend built with React and Vite.
- **RESTful API:** Well-documented API endpoints for easy integration and testing.


---

## Quickstart

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/home-decor-advisor.git
cd home-decor-advisor
```

### 2. Backend Setup (FastAPI)

#### a. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

#### b. Install dependencies

```bash
pip install -r backend/requirements.txt
```

#### c. Download/Place Model Files

- Place `sam_vit_h_4b8939.pth` in `models/`.
- Place DPT-Swin2 model data in `dpt_swin2_large_384/`.

#### d. Run the backend server

```bash
cd backend
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

### 3. Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## API Documentation

See [`frontend/API_DOCUMENTATION.md`](frontend/API_DOCUMENTATION.md) for detailed API endpoints and usage examples.

---

## Tech Stack

- **Backend:** FastAPI, Python, PyTorch, OpenCV
- **Frontend:** React, Vite, TypeScript
- **ML Models:** Segment Anything Model (SAM), DPT-Swin2

---

## Sample Usage

1. Upload a room image.
2. Select a wall or area to decorate.
3. Choose paint colors or wallpapers.
4. Preview and download the result.

---

## Model Files

- `models/sam_vit_h_4b8939.pth`: Segment Anything Model weights
- `dpt_swin2_large_384/`: DPT-Swin2 model data

> **Note:** Model files are large and not included in the repository. Download from official sources or contact the maintainer.



## 👤 Author

-[**Ashish Pandey**](https://github.com/Ashish-Pandey62)

-[**Anuj Paudel**](https://github.com/anujpaude1)

-[**Ayushma Pudasaini**](https://github.com/ayushma18)


---

