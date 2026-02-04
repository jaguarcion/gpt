# GPT CDK Activator

A comprehensive tool for activating ChatGPT CDKs (keys) via a user-friendly Web UI or a programmatic API. This application handles the complex 3-step activation process (Check -> Request -> Poll) automatically.

## 🚀 Features

-   **Web UI (SPA)**: Modern, dark-themed interface built with React & Tailwind CSS (Fully localized in Russian).
-   **API Server**: Local Node.js server to activate keys programmatically via HTTP requests.
-   **Secure Access**: API protected by Bearer Token authentication.
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

    > **Tip**: To run the server in the background, use PM2:
    > ```bash
    > npm install -g pm2
    > pm2 start server.js --name "gpt-api"
    > pm2 save
    > pm2 startup
    > ```

2.  Send a POST request to activate a key:

    **Endpoint:** `POST http://localhost:3001/api/activate-key`
    **Auth:** Bearer Token (Default: `my-secret-token-123` - change in `server.js`)

    **cURL Example:**
    ```bash
    curl -X POST http://localhost:3001/api/activate-key \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer my-secret-token-123" \
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

## 🚢 Production Deployment

### Build Frontend
To build the static files for production:
```bash
npm run build
```
The output will be in the `dist` directory.


## ⚠️ Notes

-   **Session JSON**: This is the full JSON object containing your user session details (cookies/tokens) required by the upstream provider.
-   **Currency Conflict**: If you receive a 400 error about "currency mismatch" (e.g., KZT vs USD), try using a fresh OpenAI account without prior transaction history.
