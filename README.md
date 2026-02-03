# GPT CDK Activator

A comprehensive tool for activating ChatGPT CDKs (keys) via a user-friendly Web UI or a programmatic API. This application handles the complex 3-step activation process (Check -> Request -> Poll) automatically.

## 🚀 Features

-   **Web UI (SPA)**: Modern, dark-themed interface built with React & Tailwind CSS.
-   **API Server**: Local Node.js server to activate keys programmatically via HTTP requests.
-   **Automatic Polling**: Handles the asynchronous activation queue automatically.
-   **CORS Proxy**: Configured to communicate securely with the upstream activation service.
-   **Real-time Logs**: Visual feedback of every step in the activation process.

## 🛠 Tech Stack

-   **Frontend**: React, Vite, Tailwind CSS, Axios
-   **Backend (Proxy/API)**: Node.js, Express
-   **Language**: TypeScript (Frontend), JavaScript (Backend)

## 📦 Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/gpt-cdk-activator.git
    cd gpt-cdk-activator
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## 🖥️ Usage

### Option 1: Web UI (Browser)

Use this for manual activation with a visual interface.

1.  Start the development server:
    ```bash
    npm run dev
    ```
2.  Open your browser at `http://localhost:5173`.
3.  Enter your **CDK Key** and **Session JSON**.
4.  Click **Activate** and watch the console for progress.

### Option 2: API Server (Programmatic)

Use this to integrate activation into your own scripts or bots.

1.  Start the local API server:
    ```bash
    node server.js
    ```
    *Server runs on `http://localhost:3001`*

2.  Send a POST request to activate a key:

    **Endpoint:** `POST http://localhost:3001/api/activate-key`

    **cURL Example:**
    ```bash
    curl -X POST http://localhost:3001/api/activate-key \
      -H "Content-Type: application/json" \
      -d '{
        "cdk": "YOUR_CDK_KEY",
        "sessionJson": "YOUR_SESSION_JSON_STRING_OR_OBJECT"
      }'
    ```

    **Response Example:**
    ```json
    {
      "success": true,
      "message": "Successfully activated",
      "data": {
        "task_id": "...",
        "success": true,
        "pending": false
      }
    }
    ```

## ⚠️ Notes

-   **Session JSON**: This is the full JSON object containing your user session details (cookies/tokens) required by the upstream provider.
-   **Proxy**: The project uses a proxy to bypass CORS restrictions enforced by the upstream API (`freespaces.gmailshop.top`).
