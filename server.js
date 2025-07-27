// server.js
import express from "express";
import path from "path";
import connection from "./db.js";
import { fileURLToPath } from "url";
import session from "express-session";
import fetch from "node-fetch"; // to use API

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(session({
  secret: "portfolio-secret",
  resave: false,
  saveUninitialized: true
}));

// Signup
app.post("/signup", (req, res) => {
  const { name, username, password } = req.body;
  const sql = "INSERT INTO users (name, username, password) VALUES (?, ?, ?)";
  connection.query(sql, [name, username, password], (err) => {
    if (err) return res.send("Signup failed.");
    res.redirect("/login.html");
  });
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  connection.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
    if (err || results.length === 0) return res.send("User not found.");
    if (results[0].password !== password) return res.send("Wrong password.");

    req.session.user = { id: results[0].id, name: results[0].name };
    res.redirect("/stocks.html");
  });
});

// Add stock
app.post("/add-stock", (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");
  const { stock, quantity, price } = req.body;
  const sql = "INSERT INTO portfolios (user_id, stock, quantity, price) VALUES (?, ?, ?, ?)";
  connection.query(sql, [req.session.user.id, stock, quantity, price], (err) => {
    if (err) return res.send("Failed to add stock.");
    res.redirect("/stocks.html");
  });
});

// View portfolio (with current price and P/L in ₹)
app.get("/view-portfolio", async (req, res) => {
  if (!req.session.user) return res.redirect("/login.html");

  connection.query("SELECT * FROM portfolios WHERE user_id = ?", [req.session.user.id], async (err, results) => {
    if (err) return res.send("Error fetching portfolio.");

    // Replace this with your real API key and real fetch
    const fetchCurrentPrice = async (symbol) => {
      try {
        const response = await fetch(`https://api.twelvedata.com/price?symbol=${symbol}&apikey=4c2d946fbc5a476db6210e040dd7f94a`);
        const data = await response.json();
        return parseFloat(data.price);
      } catch (error) {
        return null;
      }
    };

    const updated = await Promise.all(results.map(async (stock) => {
      const currentPrice = await fetchCurrentPrice(stock.stock);
      const totalCost = stock.quantity * stock.price;
      const currentValue = stock.quantity * currentPrice;
      const profitLoss = currentValue - totalCost;
      return {
        ...stock,
        currentPrice,
        profitLoss
      };
    }));

    let html = `
      <html><head><title>Your Portfolio</title>
      <link rel="stylesheet" href="style.css">
      </head><body>
      <h1>Welcome, ${req.session.user.name}!</h1>
      <table border="1">
        <tr>
          <th>Stock</th><th>Quantity</th><th>Buy Price (₹)</th>
          <th>Current Price (₹)</th><th>Profit/Loss (₹)</th>
        </tr>
    `;

    updated.forEach(stock => {
      html += `<tr>
        <td>${stock.stock}</td>
        <td>${stock.quantity}</td>
        <td>₹${stock.price}</td>
        <td>₹${stock.currentPrice}</td>
        <td style="color:${stock.profitLoss >= 0 ? 'green' : 'red'}">₹${stock.profitLoss.toFixed(2)}</td>
      </tr>`;
    });

    html += "</table><br><a href='/stocks.html'>← Back</a></body></html>";
    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
