# ⚔️ Tactical RPG Platform

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat&logo=angular&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=flat&logo=socketdotio&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![SASS](https://img.shields.io/badge/SASS-CC6699?style=flat&logo=sass&logoColor=white)
![Jasmine](https://img.shields.io/badge/Jasmine-8A4182?style=flat&logo=jasmine&logoColor=white)

---

A high-performance, full-stack web application for creating, managing, and playing turn-based tactical role-playing games. This project features a robust map editor, real-time multiplayer synchronization, and a custom game engine with complex movement and combat logic.

---

## 🚀 Technical Deep Dive (For Recruiters)

This project serves as a showcase for advanced software engineering principles and complex algorithm implementation:

* **Dynamic Pathfinding & Cost Logic:** Implemented a custom navigation system that calculates reachable tiles in real-time, accounting for variable terrain costs (e.g., *Ice = 0*, *Water = 2*) and impassable obstacles (*Walls*).
* **Real-time Synchronization:** Leveraged **WebSockets** for low-latency communication, ensuring that movements, combat dice rolls, and chat messages are synchronized across all connected clients instantly.
* **State Machine Architecture:** Managed complex game phases (*Preparation, Exploration, Combat, and End-of-Turn*) using a rigorous state-controlled engine to prevent illegal moves and ensure data integrity.
* **Behavioral AI (Virtual Players):** Engineered rule-based AI profiles (*Aggressive vs. Defensive*) that utilize different pathfinding priorities and combat stances based on their persona.
* **Validation Engine:** Built a comprehensive map validation tool that uses graph traversal to ensure every custom-built map is "playable" (e.g., ensuring spawn points reach flags and shrines).

---

## ✨ Key Features

### 🛠️ The Map Architect (Editor)
* **Grid Scaling:** Support for dynamic grid sizes ($10 \times 10, 15 \times 15, 20 \times 20$) supporting up to 6 players.
* **Intelligent Tiles:** Place interactive terrain including **Ice** (slippery), **Water** (slow), and **Doors** (toggleable).
* **Strategic Objects:** Place healing shrines, combat altars, and objective flags (CTF mode) to balance gameplay.

### 🎮 Gameplay Mechanics
* **Game Modes:** Supports *Classic (Deathmatch)* and *Capture the Flag (CTF)*.
* **Tactical Combat:** A simultaneous duel system where players choose Offensive or Defensive stances, directly influencing RNG dice outcomes and damage calculations.
* **Live Chat & Logs:** A real-time chat system integrated with a "Game Log" that records every movement and combat event for full transparency.

### 🛡️ Admin & Debug Suite
* **Room Management:** Features a lobby system where the organizer can lock the room, kick players, or add AI bots.
* **Developer "God Mode":** An integrated debug console allowing for instant teleportation, forced turn endings, and deterministic dice rolls (Max value for admin, Min for opponents) to facilitate rapid testing.

---

## 🏗️ Software Patterns Used

| Pattern | Application |
| :--- | :--- |
| **Observer** | Keeps the UI reactive to background game state changes. |
| **Strategy** | Facilitates switching between different AI behaviors and game mode win-conditions. |
| **Singleton/Services** | Manages shared resources like the Socket connection and User Session. |

---

## ⌨️ Controls & Usage

| Action | Key / Input |
| :--- | :--- |
| **Movement** | `W`, `A`, `S`, `D` (or Arrow Keys) |
| **Toggle Debug Mode** | `M` (Organizer Only) |
| **Teleport** | `Right Click` (While in Debug Mode) |
| **Interacting** | Automatic upon entering tile |

---

## 🎓 Project Origin

Developed for **LOG2995 - Web Application Software Project** at **Polytechnique Montréal** (Winter 2026).

This project represents a full-semester effort in **Agile development**, focusing on modularity, automated testing, and professional UX design.
