# 🛡️ Testmate (Sentinel) - User Manual

## 🚀 One-Stop Setup

### 1. Install & build
```bash
npm install                     # Install root deps
cd Sentinel/client && npm install && npm run build && cd ../.. 
```

### 2. Run
```bash
npm start
```
*   This starts the **Gateway** at `http://localhost:3000`.
*   The **Dashboad UI** is also served here! No need to run a separate client.

### 3. Connect to IDE
Add this to your IDE's MCP settings:
```json
{
  "mcpServers": {
    "testmate": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/testmate/gateway.js"]
    }
  }
}
```

### 4. Magic Exerience ✨
Tell your Agent: *"Run functional tests for user login."*

The Agent will call Sentinel -> **Your browser will automatically pop up** at `http://localhost:3000` showing the live dashboard!
