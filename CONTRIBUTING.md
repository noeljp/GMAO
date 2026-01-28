# Contributing to GMAO

Thank you for considering contributing to GMAO (Gestion de Maintenance Assistée par Ordinateur)! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)

## Code of Conduct

This project follows a Code of Conduct to ensure a welcoming environment for all contributors. Please be respectful and professional in all interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Environment details** (OS, Docker version, Node.js version)
- **Screenshots** if applicable
- **Error logs** from Docker or console

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear description** of the feature
- **Use case** explaining why it's useful
- **Potential implementation** approach (if you have one)
- **Examples** from other applications (if applicable)

### Code Contributions

We welcome code contributions! Here's how to get started:

## Development Setup

### Prerequisites

- Docker 24.0+ and Docker Compose 2.0+
- Node.js 18+ (for local development)
- Git 2.30+
- A code editor (VS Code recommended)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/GMAO.git
   cd GMAO
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/noeljp/GMAO.git
   ```

### Setup Development Environment

1. Copy environment files:
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```

2. Start development environment:
   ```bash
   docker compose up -d
   ```

3. Initialize database:
   ```bash
   docker compose exec backend npm run migrate
   ```

4. Access the application:
   - Frontend: http://localhost:3010
   - Backend: http://localhost:5010

### Running Tests

```bash
# Backend tests
docker compose exec backend npm test

# Backend tests with coverage
docker compose exec backend npm run test:ci

# Frontend tests (when available)
docker compose exec frontend npm test
```

## Coding Standards

### General Guidelines

- Write clear, readable code with meaningful variable names
- Add comments for complex logic
- Keep functions small and focused
- Follow DRY (Don't Repeat Yourself) principle
- Write tests for new features

### JavaScript/Node.js Style

- Use **ES6+** features (const/let, arrow functions, async/await)
- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Always use **semicolons**
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and React components

Example:
```javascript
const getUserById = async (userId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM utilisateurs WHERE id = $1',
      [userId]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error fetching user:', error);
    throw error;
  }
};
```

### React/Frontend Style

- Use **functional components** with hooks
- Use **Material-UI** components for consistency
- Keep components small and reusable
- Use **PropTypes** or TypeScript for type checking
- Follow React best practices

Example:
```jsx
import React, { useState, useEffect } from 'react';
import { Button, TextField, Box } from '@mui/material';

const UserForm = ({ userId, onSave }) => {
  const [formData, setFormData] = useState({ name: '', email: '' });

  useEffect(() => {
    if (userId) {
      fetchUser(userId);
    }
  }, [userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <TextField
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <Button type="submit">Save</Button>
    </Box>
  );
};

export default UserForm;
```

### Database Guidelines

- Use **parameterized queries** to prevent SQL injection
- Add proper **indexes** for frequently queried columns
- Use **transactions** for multi-step operations
- Follow naming conventions:
  - Tables: lowercase with underscores (e.g., `ordres_travail`)
  - Columns: lowercase with underscores (e.g., `created_at`)
  - Foreign keys: `table_id` (e.g., `site_id`)

### API Design

- Follow **RESTful** conventions
- Use appropriate **HTTP methods** (GET, POST, PUT, PATCH, DELETE)
- Return consistent **JSON responses**
- Include proper **error handling**
- Use **HTTP status codes** correctly:
  - 200: Success
  - 201: Created
  - 400: Bad Request
  - 401: Unauthorized
  - 403: Forbidden
  - 404: Not Found
  - 500: Internal Server Error

### Security Guidelines

- Never commit **secrets or credentials**
- Use **environment variables** for configuration
- Validate **all user inputs**
- Use **parameterized queries** for database
- Implement **rate limiting** on sensitive endpoints
- Hash **passwords** with bcrypt
- Use **JWT** for authentication
- Implement **HTTPS** in production

## Pull Request Process

### Before Submitting

1. **Update from upstream:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes:**
   - Write clean, tested code
   - Follow coding standards
   - Add/update documentation
   - Add/update tests

4. **Test your changes:**
   ```bash
   # Run tests
   docker compose exec backend npm test
   
   # Test manually
   docker compose up -d
   # Access http://localhost:3010 and verify
   ```

5. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add user profile page"
   ```

   Use conventional commit messages:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting)
   - `refactor:` Code refactoring
   - `test:` Adding or updating tests
   - `chore:` Maintenance tasks

6. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

### Creating the Pull Request

1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Fill in the template:
   - **Title**: Clear, descriptive title
   - **Description**: What changes you made and why
   - **Related Issues**: Link to related issues
   - **Testing**: How you tested the changes
   - **Screenshots**: If UI changes

### PR Review Process

- Maintainers will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Commit messages follow conventions
- [ ] Changes are focused and minimal
- [ ] Security implications considered

## Project Structure

```
GMAO/
├── backend/              # Node.js/Express API
│   ├── src/
│   │   ├── config/      # Configuration files
│   │   ├── database/    # Migrations and seeds
│   │   ├── middleware/  # Express middleware
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   └── server.js    # Entry point
│   └── tests/           # Backend tests
│
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── context/     # React context
│   │   ├── pages/       # Page components
│   │   └── App.js       # Main app component
│   └── public/          # Static assets
│
├── docs/                # Documentation
└── docker-compose.yml   # Docker orchestration
```

## Getting Help

- Check existing [documentation](./INSTALLATION_FROM_SCRATCH.md)
- Search [existing issues](https://github.com/noeljp/GMAO/issues)
- Create a new issue with your question
- Join community discussions

## Recognition

Contributors will be recognized in:
- Project README
- Release notes
- GitHub contributors page

Thank you for contributing to GMAO! 🎉
