# KhoQR — Quản Lý Tồn Kho Thông Minh

App quản lý tồn kho bằng QR Code dành cho cửa hàng. Nhân viên chỉ cần quét mã QR để kiểm kho, nhập kho, xuất kho — không cần tìm kiếm tên thủ công.

---

## 🗂️ Cấu Trúc File

```
inventory-qr-app/
├── index.html       ← Frontend SPA
├── styles.css       ← Dark theme, mobile-first
├── app.js           ← Logic ứng dụng
├── manifest.json    ← PWA manifest
├── Code.gs          ← Google Apps Script backend
└── README.md
```

---

## 🚀 Hướng Dẫn Deploy

### Bước 1: Thiết Lập Google Sheets + GAS

1. **Tạo Google Spreadsheet mới** tại [sheets.google.com](https://sheets.google.com)
2. **Mở Apps Script**: Menu `Extensions → Apps Script`
3. **Xoá nội dung cũ**, dán toàn bộ nội dung file `Code.gs` vào
4. **Lưu** (Ctrl+S), đặt tên project (VD: `KhoQR Backend`)
5. **Chạy hàm setupSheets** một lần:
   - Chọn hàm `setupSheets` trong dropdown
   - Bấm **Run ▶**
   - Cấp quyền khi được hỏi
6. **Deploy Web App**:
   - `Deploy → New Deployment`
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Bấm **Deploy**
7. **Copy URL** (dạng `https://script.google.com/macros/s/AKfy...`)

### Bước 2: Deploy Frontend lên GitHub Pages

1. **Tạo GitHub Repository mới** (public) tại [github.com/new](https://github.com/new)
2. **Upload toàn bộ file** (`index.html`, `styles.css`, `app.js`, `manifest.json`) vào repo
3. **Bật GitHub Pages**:
   - Settings → Pages
   - Source: **Deploy from a branch**
   - Branch: `main` / folder: `/ (root)`
   - Bấm **Save**
4. URL app sẽ là: `https://<username>.github.io/<repo-name>/`

### Bước 3: Kết Nối App

1. Mở URL GitHub Pages trên điện thoại
2. App sẽ hiện màn hình thiết lập
3. Nhập **tên cửa hàng** và **URL GAS** vừa copy
4. Bấm **Bắt Đầu** — Xong! ✅

---

## 📱 Tính Năng

| Tính Năng | Mô Tả |
|-----------|-------|
| **Quét QR Kiểm Kho** | Camera scan → hiện thông tin → nhập số lượng thực tế → lưu |
| **Xuất Kho** | Quét QR → nhập số lượng xuất → lưu log |
| **Nhập Kho** | Quét QR hàng nhập → nhập số lượng → cập nhật tồn |
| **Dashboard** | Tổng quan tồn kho, cảnh báo sắp hết, giao dịch gần đây |
| **Danh Sách** | Xem toàn bộ tồn kho, tìm kiếm, lọc theo trạng thái |
| **Tạo QR Code** | Sinh và in QR cho từng nguyên liệu (đơn lẻ hoặc hàng loạt) |
| **Lịch Sử** | Log toàn bộ giao dịch nhập/xuất/kiểm kho |
| **Quản Lý** | Thêm/sửa/xoá nguyên liệu |

---

## 📝 Cấu Trúc Google Sheets (tự động tạo)

### Sheet: `NhapLieu` (Master Inventory)
| MaNL | TenNL | DonVi | TonHienTai | TonToiThieu | TonToiDa | GhiChu | NgayCapNhat |

### Sheet: `LichSu` (Lịch Sử)
| ThoiGian | MaNL | TenNL | Loai | SoLuong | NhanVien | GhiChu | TonTruoc | TonSau |

### Sheet: `KiemKho` (Kiểm Kho Sessions)
| ThoiGian | MaNL | TenNL | TonHeTHong | TonThucTe | ChenhLech | NhanVien | GhiChu |

---

## 📌 Lưu Ý

- QR code chứa **chỉ mã nguyên liệu** (VD: `NL001`), không phải URL
- App hoạt động tốt nhất trên **điện thoại** (mobile-first)
- Có thể dùng **Chế Độ Demo** để test mà không cần GAS
- Backend dùng **JSONP** để tránh lỗi CORS với GAS

---

## 🔧 Cập Nhật GAS Sau Khi Sửa Code

Khi cần sửa `Code.gs`, phải **deploy version mới**:
`Deploy → Manage Deployments → Edit → New Version → Deploy`

> ⚠️ URL deployment không đổi khi tạo version mới — không cần cập nhật frontend.
