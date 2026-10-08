// network.js - PeerJS WebRTC P2P Multiplayer Networking for Congresso Kombat

export class NetworkManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomCode = null;
    this.isConnected = false;
    this.onConnectedCallback = null;
    this.onDataCallback = null;
    this.onDisconnectedCallback = null;
    this.ping = 0;
    this.lastPingSent = 0;
  }

  // Generate a random 4-digit room code
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'CK-';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  // Create Room as Host (Player 1)
  createRoom(onReady, onConnected, onData, onDisconnected) {
    this.isHost = true;
    this.onConnectedCallback = onConnected;
    this.onDataCallback = onData;
    this.onDisconnectedCallback = onDisconnected;

    const code = this.generateRoomCode();
    this.roomCode = code;

    // Destroy existing peer if any
    if (this.peer) this.peer.destroy();

    const PeerClass = window.Peer;
    if (!PeerClass) {
      console.error('[Network] PeerJS não encontrado no window!');
      return;
    }

    // Connect to free PeerJS signaling cloud
    this.peer = new PeerClass(code, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      console.log(`[Network] Sala criada com ID: ${id}`);
      this.roomCode = id;
      if (onReady) onReady(id);
    });

    this.peer.on('connection', (connection) => {
      console.log('[Network] Adversário conectou na sala!');
      this.conn = connection;
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.error('[Network] Erro no Peer:', err);
      // Fallback if ID was taken: regenerate code
      if (err.type === 'unavailable-id') {
        this.createRoom(onReady, onConnected, onData, onDisconnected);
      }
    });
  }

  // Join Room as Client (Player 2)
  joinRoom(targetCode, onConnected, onData, onDisconnected, onError) {
    this.isHost = false;
    this.onConnectedCallback = onConnected;
    this.onDataCallback = onData;
    this.onDisconnectedCallback = onDisconnected;

    const cleanCode = targetCode.trim().toUpperCase();
    this.roomCode = cleanCode;

    if (this.peer) this.peer.destroy();

    const PeerClass = window.Peer;
    if (!PeerClass) {
      console.error('[Network] PeerJS não encontrado!');
      return;
    }

    // Anonymous peer ID for client
    this.peer = new PeerClass(null, {
      debug: 1
    });

    this.peer.on('open', (myId) => {
      console.log(`[Network] Cliente aberto com ID: ${myId}, conectando em: ${cleanCode}`);
      const connection = this.peer.connect(cleanCode, {
        reliable: true
      });
      this.conn = connection;
      this.setupConnection();
    });

    this.peer.on('error', (err) => {
      console.error('[Network] Erro ao conectar:', err);
      if (onError) onError(err);
    });
  }

  setupConnection() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      console.log('[Network] Canal WebRTC P2P aberto e pronto!');
      this.isConnected = true;
      if (this.onConnectedCallback) this.onConnectedCallback(this.isHost);

      // Start ping loop
      this.pingInterval = setInterval(() => {
        if (this.isConnected && this.conn) {
          this.lastPingSent = performance.now();
          this.send({ type: 'ping', t: this.lastPingSent });
        }
      }, 2000);
    });

    this.conn.on('data', (data) => {
      if (data && data.type === 'ping') {
        this.send({ type: 'pong', t: data.t });
        return;
      }
      if (data && data.type === 'pong') {
        this.ping = Math.round(performance.now() - data.t);
        return;
      }

      if (this.onDataCallback) {
        this.onDataCallback(data);
      }
    });

    this.conn.on('close', () => {
      console.log('[Network] Conexão encerrada pelo oponente.');
      this.isConnected = false;
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.onDisconnectedCallback) this.onDisconnectedCallback();
    });

    this.conn.on('error', (err) => {
      console.error('[Network] Erro na conexão:', err);
      this.isConnected = false;
      if (this.onDisconnectedCallback) this.onDisconnectedCallback();
    });
  }

  send(data) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  disconnect() {
    this.isConnected = false;
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.conn) {
      try { this.conn.close(); } catch(e){}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch(e){}
      this.peer = null;
    }
  }
}

export const networkManager = new NetworkManager();
