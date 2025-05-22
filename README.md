# Gym Registration API

A full-stack web application for managing gym training registrations with RESTful API and interactive frontend.

## 📋 Features

- **Authentication**: JWT-based authentication with login/logout
- **Trainee Management**: Full CRUD operations for gym members
- **Workout Types**: Manage different types of workouts
- **Training Routines**: Set availability schedules for trainees
- **Registrations**: Book and manage workout sessions
- **OpenAPI Documentation**: Swagger UI for API testing (English and Estonian)
- **Responsive Frontend**: Modern web interface for all operations

## 🛠 Technology Stack

### Backend
- **Node.js** with Express.js
- **SQLite** database
- **Prisma ORM** for database management
- **JWT** for authentication
- **bcrypt** for password hashing
- **CORS** enabled
- **Swagger UI** for API documentation

### Frontend
- **Vanilla JavaScript** (ES6+)
- **HTML5** and **CSS3**
- **Responsive design**
- **Fetch API** for HTTP requests

## 📁 Project Structure

```
gym-registration-api/
├── README.md
├── .env.example
├── .gitignore
├── package.json
├── server.js
├── openapi.yaml         # English API documentation
├── openapi-et.yaml      # Estonian API documentation
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── dev.db          # SQLite database (auto-generated)
│   └── migrations/     # Database migrations
└── client/             # Frontend files
    ├── index.html      # Login page
    ├── dashboard.html  # Main dashboard
    ├── trainees.html   # Trainees management
    ├── workouts.html   # Workouts management
    ├── routines.html   # Routines management
    ├── registrations.html # Registrations management
    ├── css/
    │   └── style.css   # Styles
    └── js/
        ├── config.js   # Configuration
        ├── api.js      # API utilities
        ├── auth.js     # Authentication
        ├── dashboard.js
        ├── trainees.js
        ├── workouts.js
        ├── routines.js
        └── registrations.js
```

## 🚀 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (Node Package Manager)
- Python 3.x (for serving frontend)

### Setup Instructions

1. **Clone the repository**
```bash
git clone https://github.com/sanderprii/gym-registration-api
cd gym-registration-api
```

2. **Install dependencies**

```bash
apt install npm
```

```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` file:
```env
PORT=3000
JWT_SECRET=your_secret_key_here
DATABASE_URL="file:./dev.db"
```

4. **Initialize database**
```bash
# Generate Prisma client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name init
```

## 🏃‍♂️ Running the Application

### Start the Backend Server
```bash
npm start
```
The API will be available at `http://localhost:3000`

### Serve the Frontend
```bash
# Navigate to client directory
cd client

# Using Python (recommended)
python3 -m http.server 8080

# Or using Node.js http-server (if installed)
npm install -g http-server
http-server -p 8080
```
The frontend will be available at `http://localhost:8080`

## 📖 API Documentation

### Interactive Documentation
- **English**: `http://localhost:3000/api-docs-en`
- **Estonian**: `http://localhost:3000/api-docs-et`

### Main Endpoints

#### Authentication
- `POST /sessions` - Login
- `DELETE /sessions` - Logout
- `GET /sessions` - Check session

#### Trainees
- `GET /trainees` - List all trainees (with pagination)
- `POST /trainees` - Create new trainee
- `GET /trainees/:id` - Get trainee details
- `PATCH /trainees/:id` - Update trainee
- `DELETE /trainees/:id` - Delete trainee

#### Workouts
- `GET /workouts` - List all workouts
- `POST /workouts` - Create new workout
- `GET /workouts/:id` - Get workout details
- `PATCH /workouts/:id` - Update workout
- `DELETE /workouts/:id` - Delete workout

#### Routines
- `GET /routines` - List all routines
- `POST /routines` - Create new routine
- `GET /routines/trainee/:traineeId` - Get trainee's routine
- `PATCH /routines/trainee/:traineeId` - Update routine
- `DELETE /routines/trainee/:traineeId` - Delete routine

#### Registrations
- `GET /registrations` - List all registrations
- `POST /registrations` - Create new registration
- `GET /registrations/:id` - Get registration details
- `PATCH /registrations/:id` - Update registration
- `DELETE /registrations/:id` - Delete registration

## 💾 Database Schema

### Tables
- **Trainees**: User accounts for gym members
- **Workouts**: Different types of workouts
- **Routines**: Availability schedules for trainees
- **Registrations**: Bookings for workout sessions

### Relationships
- One trainee can have multiple routines
- One trainee can have multiple registrations
- Routines and registrations belong to a trainee

## 🎯 Usage Guide

### For Administrators

1. **Access the application**: Open `http://localhost:8080`
2. **Create an account**: Click "Register here" on login page
3. **Login**: Use your credentials to access the dashboard
4. **Manage entities**:
   - Add/edit/delete trainees
   - Configure workout types
   - Set up training routines
   - Manage registrations

### For API Consumers

Use the interactive Swagger documentation at `/api-docs-en` or `/api-docs-et` to:
- Explore available endpoints
- Test API calls
- View request/response schemas
- Understand authentication requirements

## 🔧 Development

### Database Operations
```bash
# View data in Prisma Studio
npx prisma studio

# Reset database (destructive)
npx prisma migrate reset

# Create new migration
npx prisma migrate dev --name migration_name

# Generate Prisma client after schema changes
npx prisma generate
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `JWT_SECRET`: Secret key for JWT tokens
- `DATABASE_URL`: Database connection string

## 📝 Notes

- **Security**: In production, update CORS settings and use secure JWT secrets
- **Passwords**: Currently stored as plain text for demo purposes - implement bcrypt hashing for production
- **Error Handling**: Comprehensive error handling is implemented for all API endpoints
- **Responsive Design**: Frontend is mobile-friendly and adapts to different screen sizes

## 🐛 Troubleshooting

### Common Issues

1. **Prisma Client Error**
   ```bash
   npx prisma generate
   ```

2. **CORS Errors**
   - Ensure backend is running on port 3000
   - Frontend should be served from a different port (8080)

3. **Database Issues**
   ```bash
   rm prisma/dev.db
   npx prisma migrate dev --name init
   ```

4. **Port Already in Use**
   ```bash
   # Kill process on port 3000
   npx kill-port 3000
   ```

## 📄 License

This project is created for educational purposes.

## 👥 Authors

Created as part of a programming course assignment.

---

For more information, check the OpenAPI documentation or contact the development team.