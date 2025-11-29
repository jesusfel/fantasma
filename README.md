# Cazafantasmas - Juego Móvil

## 🎮 Cómo jugar en tu teléfono

### Opción 1: Servidor Local (Recomendado)

1. **Instala Python** (si no lo tienes):
   - Descarga desde python.org

2. **Abre una terminal en esta carpeta** y ejecuta:
   ```bash
   python -m http.server 8000
   ```

3. **En tu teléfono**:
   - Conecta tu teléfono a la misma red WiFi que tu PC
   - Averigua la IP de tu PC:
     - Windows: `ipconfig` (busca IPv4)
     - Mac/Linux: `ifconfig` o `ip addr`
   - Abre el navegador del teléfono y ve a: `http://TU_IP:8000`
   - Ejemplo: `http://192.168.1.100:8000`

### Opción 2: Subir a un Hosting Gratuito

**GitHub Pages (Gratis y fácil):**

1. Crea una cuenta en github.com
2. Crea un nuevo repositorio público
3. Sube todos los archivos de esta carpeta
4. Ve a Settings → Pages
5. Selecciona la rama "main" y guarda
6. Tu juego estará en: `https://tu-usuario.github.io/nombre-repo`

**Netlify Drop (Súper rápido):**

1. Ve a netlify.com/drop
2. Arrastra toda la carpeta del juego
3. ¡Listo! Te da una URL instantánea

### Opción 3: Transferir Archivos Directamente

1. Conecta tu teléfono por USB
2. Copia toda la carpeta a tu teléfono
3. Abre `index.html` con Chrome o Safari

---

## 🕹️ Controles

### PC:
- **Flechas**: Mover
- **Espacio**: Atacar

### Móvil/Tablet:
- **Lado izquierdo**: Joystick virtual (arrastra para mover)
- **Lado derecho**: Tap para atacar

---

## 📱 Requisitos

- Navegador moderno (Chrome, Safari, Firefox)
- JavaScript habilitado
- Para mejor experiencia en móvil: pantalla completa

---

## 🎯 Objetivo

- Atrapa fantasmas con tu red
- No dejes que te toquen (3 vidas)
- Cada 5 fantasmas atrapados = 1 vida recuperada
- Cada 20 fantasmas = nueva puerta/ventana
- ¡Sobrevive el mayor tiempo posible!

---

**Desarrollado con Phaser.js**
