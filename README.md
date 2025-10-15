Vigovia Travel Planner
✈️ Project Description
Vigovia Travel Planner is a modern, responsive, single-page application (SPA) designed to help users efficiently organize and manage their trip itineraries and budgets in real-time. It provides a clean, intuitive interface for planning daily activities and tracking expenses, with robust data persistence powered by Google Cloud Firestore.

The application is built using a modern React stack with Vite for performance, ensuring a fast and smooth user experience. All components are self-contained within a single file, demonstrating best practices in component architecture, state management, and external API integration (Firestore and PDF generation).

✨ Features
Real-time Itinerary Planning: Users can dynamically add, edit, and remove travel days and activities, with changes instantly saved and synced across devices.

Multi-Page Navigation: Seamless switching between the main Itinerary Builder, the Budget Planner, and the Download/Share guide using in-app state management.

Comprehensive Budget Tracking: A dedicated section to log estimated and actual costs for flights, accommodation, and activities, with calculated totals to help users stay on track.

Firestore Data Persistence: User data is securely stored and synchronized in real-time using Google Cloud Firestore, ensuring no itinerary details are lost. Authentication is handled via Firebase Custom Tokens or Anonymous Sign-in.

Professional PDF Generation: Users can generate and download a multi-page, visually-appealing PDF document of their complete itinerary and budget summary, perfect for sharing or printing.

Modern Styling: Built with Tailwind CSS for a fully responsive, mobile-first design and modern aesthetic.

🛠️ Tech Stack
Frontend: React (Functional Components & Hooks)

Styling: Tailwind CSS

Build Tool: Vite

Database: Google Cloud Firestore (Real-time data synchronization)

Authentication: Firebase Auth (Custom Tokens / Anonymous)

PDF Generation: jspdf and html2canvas

🚀 Local Setup and Development
To run this project locally, you will need Node.js installed.

1. Clone the repository
git clone [YOUR_REPOSITORY_URL]
cd vigovia-travel-planner

2. Install Dependencies
Install the required Node packages, including the core Firebase SDK.

npm install firebase

3. Environment Setup (Optional but Recommended)
This application relies on environment variables (__app_id, __firebase_config, __initial_auth_token) typically provided by a hosting platform like a Google Gemini Canvas.

For local development, you can mock these variables or set up a local .env file with your own Firebase configuration if you wish to link it to a private Firebase project.

4. Run the Application
Start the development server using Vite:

npm run dev

The application will usually be available at http://localhost:5173.

📂 Project Structure
This project follows a single-file architecture to demonstrate self-contained application development:

File

Description

src/App.jsx

The entire application. Contains all React components, state logic, Firebase integration, and PDF generation functions.

index.html

The main entry point; loads the Tailwind CSS CDN and mounts the React app.

package.json

Project dependencies and build scripts.

