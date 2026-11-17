# Garage Object Storage Setup for UMS

Garage เป็นระบบจัดเก็บอ็อบเจกต์ (S3-compatible Object Storage) น้ำหนักเบา ประสิทธิภาพสูง พัฒนาด้วยภาษา Rust เหมาะสำหรับคลัสเตอร์แบบ Distributed หรือใช้งานแบบ Single-node สำหรับระบบ UMS

---

## 🚀 การเริ่มต้นใช้งานสำหรับ Local Development

### 1. สั่งเปิดและตั้งค่าอัตโนมัติด้วยสคริปต์
```powershell
./scripts/setup-garage.ps1
```

หรือสั่งเปิดด้วย Docker Compose:
```bash
docker compose -f docker-compose.garage.yml up -d
```

### 2. คำสั่ง CLI ที่สำคัญภายในคอนเทนเนอร์
```bash
# ตรวจสอบสถานะของโหนด
docker exec ums_garage /garage status

# ตรวจสอบรายการและข้อมูลของ Bucket
docker exec ums_garage /garage bucket list
docker exec ums_garage /garage bucket info ums-uploads

# ดูรายการ Access Keys
docker exec ums_garage /garage key list
```

---

## ⚙️ การตั้งค่า Environment Variables ใน Backend (.env)

```env
GARAGE_ENDPOINT="http://localhost:3900"
GARAGE_ACCESS_KEY="<YOUR_KEY_ID>"
GARAGE_SECRET_KEY="<YOUR_SECRET_KEY>"
GARAGE_REGION="garage"
GARAGE_USE_SSL="false"
GARAGE_BUCKET="ums-uploads"
```

## 🌐 พอร์ตที่ใช้งาน (Default Ports)
- **3900**: S3 API Endpoint (สำหรับ Backend ติดต่อ Upload / Download)
- **3901**: RPC Sync Port (สำหรับการสื่อสารระหว่างคลัสเตอร์โหนด)
- **3902**: S3 Web Serving
- **3903**: Admin API & Web UI
