<!-- PROJECT BANNER -->
<br />
<div align="center">
  <a href="#">
    <!-- Suggested: Create a logo with a tool like Canva and upload it to your repo -->
    <img src="#" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">StatusTrack</h3>

  <p align="center">
    A full-featured, real-time status page application built with FastAPI and Next.js.
    <!-- Trigger Vercel deploy -->
    <br />
    <a href="#"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="#">View Demo</a>
    ·
    <a href="#">Report Bug</a>
    ·
    <a href="#">Request Feature</a>
  </p>
</div>

<!-- TECH STACK BADGES -->
<div align="center">
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io"/>
  <img src="https://img.shields.io/badge/Auth0-EB5424?style=for-the-badge&logo=auth0&logoColor=white" alt="Auth0"/>
</div>

---

## About The Project

StatusTrack is a modern, open-source status page system designed for transparency and reliability. It provides a beautiful public-facing status page, a powerful admin dashboard for managing services and incidents, and real-time updates to keep users informed instantly.

This project serves as a comprehensive demonstration of full-stack development skills, incorporating a robust backend API, a dynamic frontend, secure authentication, and a scalable architecture.

## Key Features

### For Public Users:
*   **Public Status Page:** A clean, responsive interface displaying the status of all services.
*   **Uptime History:** 90-day uptime history graphs for each service.
*   **Incident Timeline:** A detailed timeline of updates for ongoing and past incidents.
*   **Email Subscriptions:** Allows users to subscribe for real-time email notifications.

### For Administrators:
*   **Secure Authentication:** Built-in user authentication and management via Auth0.
*   **Organization Management:** Support for creating and managing multiple organizations.
*   **Service Management:** Full CRUD functionality for services.
*   **Incident Management:** Create, update, and resolve incidents and maintenances.
*   **Team Collaboration:** Invite and manage team members within an organization.
*   **Real-time Dashboard:** Instantly push updates to the public page via WebSockets.

## Screenshots

| Public Status Page | Admin Dashboard |
| :---: | :---: |
| *Your screenshot here* | *Your screenshot here* |

## Getting Started

Follow these instructions to get a local copy up and running for development and testing purposes.

### Prerequisites

*   **Python 3.10+**
*   **Node.js 18+**
*   **MongoDB:** A running instance (local or cloud-based).
*   **Auth0 Account:** A free account to handle authentication.

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/ShubhamPatilSp/StatusTrack.git
    cd StatusTrack
    ```

2.  **Backend Setup (`/backend` directory):**
    *   Create and activate a Python virtual environment:
        ```sh
        python -m venv venv
        source venv/bin/activate  # On Windows use `venv\Scripts\activate`
        ```
    *   Install dependencies:
        ```sh
        pip install -r requirements.txt
        ```
    *   Create a `.env` file and add your environment variables:
        ```env
        MONGODB_URI="your_mongodb_connection_string"
        AUTH0_DOMAIN="your_auth0_domain"
        AUTH0_API_AUDIENCE="your_auth0_api_audience"
        ```

3.  **Frontend Setup (`/frontend` directory):**
    *   Install dependencies:
        ```sh
        npm install
        ```
    *   Create a `.env.local` file and add your Auth0 and API configuration:
        ```env
        # Auth0 Credentials - You can generate a good secret with: openssl rand -base64 32
        AUTH0_SECRET='a_long_random_string_for_session_encryption'
        AUTH0_BASE_URL='http://localhost:3000'
        AUTH0_ISSUER_BASE_URL='https://your_auth0_domain'
        AUTH0_CLIENT_ID='your_auth0_client_id'
        AUTH0_CLIENT_SECRET='your_auth0_client_secret'
        
        # API URL - This should point to your backend server
        NEXT_PUBLIC_API_URL='http://localhost:8000'
        ```

4.  **Run the Application:**
    *   Start the backend server (from the `/backend` directory):
        ```sh
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
        ```
    *   Start the frontend server (from the `/frontend` directory):
        ```sh
        npm run dev
        ```

Your application should now be running!
*   **Frontend:** [http://localhost:3000](http://localhost:3000)
*   **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

## Deployment

This application is designed for easy deployment on Vercel.

1.  **Fork this repository** to your own GitHub account.
2.  **Create a new project on Vercel** and link it to your forked repository.
3.  **Configure Environment Variables:** Add all the environment variables from your `.env` and `.env.local` files to the Vercel project settings.
4.  **Deploy!** Vercel will automatically detect the Next.js frontend and the FastAPI backend (using the `vercel.json` configuration) and deploy them as serverless functions.

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact


Project Link: [https://github.com/ShubhamPatilSp/StatusTrack](https://github.com/ShubhamPatilSp/StatusTrack)
