# B2B Management Platform

A full-stack web application for managing business customers, products, categories, orders, and users through a centralized dashboard.

## Features

* **Dashboard:** Overview of customers, products, orders, revenue, and low-stock products.
* **Customer Management:** Create, view, edit, search, and delete customers.
* **Product Management:** Manage products, prices, stock levels, and availability.
* **Category Management:** Organize products into categories.
* **Order Management:** Create orders, calculate totals, update statuses, and manage stock.
* **User Management:** Manage user accounts and roles.
* **Authentication:** Login and logout using JWT authentication stored in an HttpOnly cookie.
* **Role-Based Access Control:** Admin, Manager, and Employee permissions.
* **Input Validation:** Validate incoming data and reject invalid operations.

## Technologies

### Frontend

* React
* Vite
* JavaScript
* Tailwind CSS
* React Router

### Backend

* Node.js
* Express.js
* MySQL2
* JWT
* bcrypt

### Database

* MySQL

## Project Structure

```text
b2b-management-platform/
├── frontend/
├── backend/
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── server.js
├── database/
├── docs/
└── README.md
```

## Installation

### Prerequisites

* Node.js and npm
* MySQL Server
* Git

### 1. Clone the repository

```bash
git clone https://github.com/bijigunerachid/b2b-management-platform.git
cd b2b-management-platform
```

### 2. Configure the database

Create a MySQL database named `b2b_management`.

Run your SQL schema and seed scripts from the `database/` directory, if available.

### 3. Configure the backend

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=b2b_management
JWT_SECRET=YOUR_LONG_RANDOM_SECRET
```

Replace the example values with your own configuration. Never commit `.env` to Git.

Start the backend:

```bash
npm run dev
```

### 4. Configure the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually `http://localhost:5173`.

## API Routes

| Resource       | Endpoint          |
| -------------- | ----------------- |
| Authentication | `/api/auth`       |
| Users          | `/api/users`      |
| Customers      | `/api/customers`  |
| Products       | `/api/products`   |
| Categories     | `/api/categories` |
| Orders         | `/api/orders`     |
| Dashboard      | `/api/dashboard`  |

## Security

* Passwords are hashed using bcrypt.
* JWT authentication uses an HttpOnly cookie.
* Protected routes require authentication.
* Role-based authorization restricts sensitive operations.
* Environment variables keep credentials out of source code.

## Project Status

Under development. Features and testing are being improved incrementally.

## Author

**Rachid Bijigune**

Full-Stack Development | Big Data

GitHub: https://github.com/bijigunerachid
