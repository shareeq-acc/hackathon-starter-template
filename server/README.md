# TypeScript Backend API

A comprehensive TypeScript Express server with MongoDB integration, featuring authentication, email services, and AI-powered quote generation.

## Features

- **Authentication & Authorization**: JWT-based authentication with refresh tokens
- **Google OAuth Integration**: Sign in with Google support
- **Email Services**: Nodemailer integration for transactional emails
- **AI-Powered Quotes**: Google Gemini API integration for quote generation
- **MongoDB Integration**: Mongoose ODM with connection pooling
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Testing**: Jest with property-based testing using fast-check
- **TypeScript**: Full TypeScript support with strict configuration

## Project Structure

```
src/
├── config/          # Configuration files (database, environment)
├── controllers/     # HTTP request handlers
├── services/        # Business logic layer
├── repositories/    # Data access layer
├── models/          # Database models and schemas
├── dtos/            # Data transfer objects
├── middleware/      # Express middleware
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── app.ts           # Express application setup

tests/
├── unit/            # Unit tests
├── property/        # Property-based tests
├── integration/     # Integration tests
└── setup.ts         # Test configuration
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
   - Database connection strings
   - JWT secrets (change from default values)
   - Email service credentials
   - Google OAuth credentials
   - Google Gemini API key

### Development

#### Option 1: Local Development with Docker MongoDB

1. Start MongoDB with Docker:
```bash
npm run docker:db:up
```

2. Copy Docker environment variables:
```bash
cp .env.docker .env
```

3. Start the development server:
```bash
npm run dev
```

4. (Optional) Access MongoDB Admin Interface:
```bash
npm run docker:admin:up
```
Then visit http://localhost:8081 (login: admin/admin123)

5. Stop MongoDB when done:
```bash
npm run docker:db:down
```

#### Option 2: Traditional Development

Start the development server with your own MongoDB instance:
```bash
npm run dev
```

#### Docker Commands

- `npm run docker:db:up` - Start only MongoDB container
- `npm run docker:db:down` - Stop MongoDB container
- `npm run docker:db:logs` - View MongoDB logs
- `npm run docker:admin:up` - Start MongoDB + Mongo Express admin interface
- `npm run docker:admin:down` - Stop all containers
- `npm run docker:clean` - Stop containers and remove volumes

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

### Building

Build the project:
```bash
npm run build
```

### Testing

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Production

Start the production server:
```bash
npm start
```

## Docker Setup

### Development with Docker MongoDB

The project includes a Docker Compose setup for running MongoDB during development:

**Files:**
- `docker-compose.dev.yml` - MongoDB and Mongo Express for development
- `mongo-init-dev.js` - Database initialization script
- `.env.docker` - Environment variables for Docker setup

**Quick Start:**
```bash
# Start MongoDB
npm run docker:db:up

# Copy Docker environment config
cp .env.docker .env

# Start development server
npm run dev

# Access Mongo Express (optional)
# Visit http://localhost:8081 (admin/admin123)
```

**Database Access:**
- **MongoDB**: `mongodb://admin:password123@localhost:27017/typescript-backend-api?authSource=admin`
- **Mongo Express**: http://localhost:8081 (admin/admin123)

### Production Docker

For production deployment, use the root-level `docker-compose.yml` which includes both the API server and MongoDB.

## API Endpoints

### Health Check
- `GET /health` - Application health status

### Authentication (Coming Soon)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback

### User Profile (Coming Soon)
- `GET /api/user/profile` - Get current user profile
- `PUT /api/user/profile` - Update user profile

### Quotes (Coming Soon)
- `GET /api/quotes/random` - Get random quote
- `GET /api/quotes/theme/:theme` - Get quote by theme

## Environment Variables

See `.env.example` for all required environment variables.

### Critical Variables

- `JWT_SECRET` - Secret for signing JWT tokens
- `REFRESH_TOKEN_SECRET` - Secret for signing refresh tokens
- `MONGODB_URI` - MongoDB connection string
- `GOOGLE_AI_API_KEY` - Google Gemini API key

## Security Considerations

- Change default JWT secrets in production
- Use strong passwords for database connections
- Enable HTTPS in production
- Configure CORS origins appropriately
- Set up proper rate limiting
- Use environment variables for all secrets

## Contributing

1. Follow the existing code structure and patterns
2. Write tests for new functionality
3. Use TypeScript strict mode
4. Follow the established naming conventions
5. Update documentation as needed

## License

ISC