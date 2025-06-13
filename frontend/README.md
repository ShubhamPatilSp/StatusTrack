# Status Page Application

This is a full-featured status page application built with Next.js, FastAPI, and other modern technologies. It provides a comprehensive solution for monitoring services, managing incidents, and communicating with users.

## Key Features

- **User Authentication**: Secure user authentication and management powered by Auth0.
- **Organization Management**: Create and manage multiple organizations, each with its own services and status page.
- **Service Management**: Add, edit, and delete services, and track their operational status.
- **Incident Management**: Create, update, and resolve incidents, and display them on a public status page.
- **Public Status Page**: A publicly accessible status page for each organization, displaying service statuses and incident history.
- **Real-time Updates**: Real-time updates for service statuses and incidents, powered by WebSockets.

## Technologies Used

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI, Python
- **Authentication**: Auth0
- **Real-time Communication**: Socket.IO
- **UI Components**: Shadcn UI, Lucide React

## Getting Started

To get the application up and running, follow these steps:

### Prerequisites

- Node.js
- Python
- An Auth0 account

### Installation

1.  **Clone the repository**:

    ```bash
    git clone <repository-url>
    ```

2.  **Set up the frontend**:

    ```bash
    cd frontend
    npm install
    ```

3.  **Set up the backend**:

    ```bash
    cd ../backend
    pip install -r requirements.txt
    ```

### Environment Variables

Create a `.env.local` file in the `frontend` directory and add the following environment variables:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AUTH0_DOMAIN=<your-auth0-domain>
NEXT_PUBLIC_AUTH0_CLIENT_ID=<your-auth0-client-id>
NEXT_PUBLIC_AUTH0_AUDIENCE=<your-auth0-audience>
AUTH0_SECRET=<a-long-random-string>
AUTH0_ISSUER_BASE_URL=https://<your-auth0-domain>
AUTH0_CLIENT_SECRET=<your-auth0-client-secret>
```

Create a `.env` file in the `backend` directory and add the following environment variables:

```
DATABASE_URL=<your-database-url>
AUTH0_DOMAIN=<your-auth0-domain>
AUTH0_API_AUDIENCE=<your-auth0-audience>
```

### Running the Application

1.  **Start the backend server**:

    ```bash
    cd backend
    uvicorn main:app --reload
    ```

2.  **Start the frontend development server**:

    ```bash
    cd frontend
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.
