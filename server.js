const express = require("express");
const session = require("express-session");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const answerHashes = {"1":"b73b13788d3c55d0c0c2858f461b02251fa74309de461b672a0833248c7f5d8b","2":"78122e7292652c7394b2bdcdae8124a7d24b905a8290ae68c25598e58cc03e45","3":"bb81728152dcf249195f8e40d66b0174a17bcdb4e7647c8196ad26f6621618ee","4":"56f4da26ed956730309fa1488611ee0f13b0ac95ebb1bc9b5d210e31ff70e79c","5":"d77982267d9699c2a57bcab5bb975a1935f6427002f52fd4569762fd72db3a94","6":"ae4712065a3576cba0b0f981ce6fa3829a03286b9acd8464dcbefa8eccb3097f","7":"e1c20be7b222031d9091b8ab95a5ce2b59e2ed514b86c2d1eaf064fd8abbd531","8":"676c5cebd681f9956e0cc1cd4159dbdb4b0c831725933a46851f6015166f5866","9":"f24f1a64b591544a871284bdde332d3c5d2cb109d21c03122c57d768e7c535b1","10":"e7f6c011776e8db7cd330b54174fd76f7d0216b612387a5ffcfb81e6f0919683","11":"b62228551d60a9a07c57286ee515e0972debe1db8c1006f6301750520b7ac85a","12":"6ad68cbcf3c96f357f3af817f135aac4b9a03748fe9f836cdc34c40dd1ae752e","13":"d30c5ce147fc423b730656f5061abaf2e4f118a4f1a05a2ad15e3abc0fe9afb5","14":"4cb55920477f1344a24b512cf99ef78776191dc647ea5704256153bd4e2c941d","15":"54f743bbbe02811c4851b773117404cce51839a3cd2bff8028d248f8ecf88bed"};

app.disable("x-powered-by");
app.use(express.json({ limit: "4kb" }));
app.use(session({
  name: "blackbox.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 24 * 14
  }
}));

app.use((req, res, next) => {
  if (req.session.unlocked == null) req.session.unlocked = 1;
  next();
});

app.get("/api/progress", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ unlocked: req.session.unlocked });
});

app.post("/api/verify", (req, res) => {
  res.set("Cache-Control", "no-store");
  const stage = Number(req.body && req.body.stage);
  const answer = String((req.body && req.body.answer) || "").trim().toUpperCase();
  if (!Number.isInteger(stage) || stage < 1 || stage > 15) {
    return res.status(400).json({ ok: false, message: "無効なステージです。" });
  }
  if (stage > req.session.unlocked) {
    return res.status(403).json({ ok: false, message: "先に前のステージをクリアしてください。" });
  }
  const digest = crypto.createHash("sha256").update(answer, "utf8").digest("hex");
  const expected = answerHashes[String(stage)];
  const valid = expected && crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(expected, "hex"));
  if (!valid) return res.status(400).json({ ok: false, message: "NO — 証拠をもう一度照合してください。" });

  req.session.unlocked = Math.max(req.session.unlocked, stage + 1);
  const next = stage === 15 ? "complete.html" : `stage${String(stage + 1).padStart(2, "0")}.html`;
  req.session.save(err => {
    if (err) return res.status(500).json({ ok: false, message: "進行状況を保存できませんでした。" });
    res.json({ ok: true, next });
  });
});

// Protect direct stage URLs before serving static files.
app.use((req, res, next) => {
  const match = req.path.match(/^\/stage(\d{2})\.html$/);
  if (match) {
    const stage = Number(match[1]);
    if (stage > req.session.unlocked) {
      return res.redirect(302, req.session.unlocked >= 16
        ? "/complete.html"
        : `/stage${String(req.session.unlocked).padStart(2, "0")}.html`);
    }
  }
  if (req.path === "/complete.html" && req.session.unlocked < 16) {
    return res.redirect(302, `/stage${String(req.session.unlocked).padStart(2, "0")}.html`);
  }
  next();
});

app.use(express.static(__dirname, {
  index: "index.html",
  dotfiles: "ignore",
  setHeaders(res, filePath) {
    if (/\.(html|js|json|txt|css)$/i.test(filePath)) res.setHeader("Cache-Control", "no-store");
  }
}));

app.get("*", (req, res) => res.status(404).send("Not Found"));
app.listen(PORT, "0.0.0.0", () => console.log(`BLACKBOX server listening on ${PORT}`));
