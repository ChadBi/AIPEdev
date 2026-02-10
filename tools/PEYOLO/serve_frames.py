from flask import Flask, send_from_directory
from flask_cors import CORS
import os

ROOT = r"E:\PEYOLO"

app = Flask(__name__)
CORS(app)  # 允许所有跨域

@app.route("/<path:filename>")
def serve_file(filename):
    return send_from_directory(ROOT, filename)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=9000, debug=False)