# OMG QR Scanner 2.2.1

ส่วนขยาย Chrome สำหรับสแกน QR Code จากหน้าจอ แท็บปัจจุบัน รูปภาพ และ PDF โดยเหลือ 2 แท็บหลัก:

1. **สแกนทันที** — จับภาพเฉพาะพื้นที่ที่มองเห็นในแท็บปัจจุบัน
2. **สแกนจากไฟล์** — เลือกหรือลากไฟล์ภาพ/PDF เข้ามา โดย PDF จะตรวจทุกหน้า

## จุดที่ปรับปรุง
- เปลี่ยนชื่อเป็น **OMG QR Scanner** พร้อมโลโก้ `logo.svg` และเครดิตผู้พัฒนา OMG ที่ด้านล่าง
- ปุ่ม **ล้างข้อมูลทั้งหมด** ล้าง QR ที่พบ การ์ดผลลัพธ์ ตัวอย่างภาพบน canvas และไฟล์ที่เลือกไว้ เพื่อให้เริ่มต้นใหม่จริง
- Manifest V3 ใช้ permissions `activeTab`, `tabs`, `sidePanel` และ host permission `<all_urls>`

## ติดตั้ง
1. แตก ZIP ไปยังโฟลเดอร์ `OMG-QR-Scanner-Extension-v2.2.1`
2. เปิด PowerShell ในโฟลเดอร์ที่แตกไฟล์ แล้วรัน:
   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\download-libraries.ps1
   ```
3. ตรวจว่ามี `lib/jsQR.js`, `lib/pdf.mjs` และ `lib/pdf.worker.mjs`
4. เปิด `chrome://extensions/` แล้วเปิด **Developer mode**
5. ปิด/ลบรุ่นเก่าเพื่อไม่ให้สับสน แล้วกด **Load unpacked** และเลือกโฟลเดอร์ `OMG-QR-Scanner-Extension-v2.2.1`
6. คลิกไอคอนส่วนขยายเพื่อเปิดแผงด้านข้าง

หมายเหตุ: Chrome อาจจำกัดการจับภาพบนหน้าพิเศษ เช่น `chrome://` และ Chrome Web Store ตามข้อจำกัดของเบราว์เซอร์


### ไอคอนบนแถบเครื่องมือ Chrome
เพิ่ม `icon16.png`, `icon32.png`, `icon48.png` และ `icon128.png` ใน Manifest แล้ว ไอคอนจะปรากฏบนปุ่มส่วนขยายของ Chrome และหน้า Extensions โดยใช้โลโก้ OMG QR Scanner
