# Vuetation — hướng dẫn cho tester

Extension giúp bạn báo bug chi tiết hơn: click vào chỗ bị lỗi, ghi chú, rồi copy ra
một báo cáo đã kèm sẵn **lỗi console**, **request bị fail**, và **các bước bạn vừa làm**.

---

## 1. Cài đặt (làm 1 lần, ~2 phút)

1. Giải nén file `vuetation.zip` ra một thư mục **cố định** — đừng để trong Downloads
   rồi xoá, Chrome cần thư mục này tồn tại lâu dài.
2. Mở Chrome, vào `chrome://extensions`
3. Bật **Developer mode** (góc trên bên phải)
4. Bấm **Load unpacked** → chọn thư mục vừa giải nén (thư mục có file `manifest.json`)
5. Xong. Icon chữ V màu xanh sẽ hiện trên thanh công cụ.

> **Chrome sẽ hiện popup "Disable developer mode extensions" mỗi lần mở.**
> Bấm **Cancel** (đừng bấm Disable). Đây là cảnh báo mặc định của Chrome cho mọi
> extension cài kiểu này, không phải lỗi.

**Khi có bản mới:** thay file trong đúng thư mục cũ, rồi vào `chrome://extensions`
bấm nút ⟳ trên card của Vuetation. Sau đó **reload lại tab đang test**.

---

## 2. Cách dùng

### Quy trình chuẩn

1. **Dùng app bình thường** cho tới khi gặp bug. Không cần bật gì trước —
   extension đã tự ghi lỗi console và request fail ngay từ lúc trang load.
2. Khi thấy bug, bấm **Inspect** trên thanh công cụ góc dưới bên phải
   (hoặc <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>).
3. **Click vào đúng chỗ bị lỗi** → gõ mô tả → **Add note**.
4. Bấm icon danh sách → **Copy report** → paste vào Jira/Slack.

> ⚠️ **Quan trọng:** hãy dùng app *trước*, bật Inspect *sau*. Khi Inspect đang bật,
> click sẽ bị extension giữ lại để chọn element, app sẽ không nhận click đó.

### Phím tắt

| Phím | Tác dụng |
|---|---|
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | Bật/tắt Inspect |
| <kbd>1</kbd> | Chọn theo element (mặc định) |
| <kbd>2</kbd> | Chọn theo đoạn text |
| <kbd>3</kbd> | Kéo chọn nhiều element |
| <kbd>F</kbd> | Đóng băng animation (để bắt đúng khoảnh khắc lỗi) |
| <kbd>A</kbd> | Mở danh sách ghi chú |
| <kbd>Esc</kbd> | Huỷ / thoát Inspect |

### Mẹo

- **Bug chỉ xuất hiện lúc animation đang chạy?** Bấm <kbd>F</kbd> để đóng băng, rồi
  mới annotate.
- **Cần ảnh?** Trong ô ghi chú có icon máy ảnh — lưu ảnh cắt sẵn vùng element vào
  thư mục Downloads.
- **Độ chi tiết** đổi được ở dropdown cạnh nút Copy. Mặc định **Standard** là đủ.
  Chọn **Detailed** nếu dev yêu cầu thêm stack trace.
- Ghi chú được lưu theo từng trang, F5 không mất.

---

## 3. Báo cáo trông như thế nào

```markdown
## Page feedback: /buggy.html

### 1. button "Save changes"
**Location:** .settings-card > .save
**Feedback:** Bấm Save không có phản hồi gì, console báo lỗi.

---

## Steps to reproduce
1. Edited Email address  `+0.0s`
2. Edited Password  `+0.0s`
3. Clicked button "Save changes"  `+0.1s`

## Console errors (4)
- `+0.0s` **Uncaught:** TypeError: Cannot read properties of undefined (reading 'profile') — /buggy.html:68
- `+0.1s` **console.error:** Save clicked but no handler is wired up

## Failed requests (2)
- `+0.0s` **404** Not Found — GET /api/seller/profile?access_token=[redacted]&page=2 (9ms)
- `+0.0s` **404** Not Found — POST /api/seller/settings (9ms)
```

---

## 4. Về quyền riêng tư

Extension chạy hoàn toàn trên máy bạn — **không gửi dữ liệu đi đâu cả**. Mọi thứ chỉ
nằm trong clipboard khi bạn chủ động bấm Copy.

Những thứ **không bao giờ** bị ghi lại:

- **Giá trị bạn gõ vào form.** Báo cáo chỉ ghi *"Edited Password"*, không bao giờ ghi
  mật khẩu bạn nhập.
- **Nội dung request/response.** Chỉ ghi method, đường dẫn, mã lỗi và thời gian.
- **Token trong URL.** Các tham số kiểu `access_token`, `api_key`, `signature`… bị
  thay bằng `[redacted]` trước khi vào báo cáo.

Dù vậy, báo cáo **có** chứa đường dẫn URL và text hiển thị trên màn hình. Nếu đang
test với dữ liệu khách hàng thật, đọc lướt qua báo cáo trước khi paste vào chỗ công khai.

Muốn tắt hẳn phần tự động ghi này: click icon extension → bỏ tick **Capture errors & steps**.

---

## 5. Gặp vấn đề?

| Hiện tượng | Xử lý |
|---|---|
| Không thấy thanh công cụ | Reload lại tab. Extension không chạy trên `chrome://`, Chrome Web Store, và file PDF. |
| Badge ghi "No Vue detected" | Bình thường trên trang không phải Vue — vẫn annotate và ghi lỗi được đầy đủ. |
| Copy không ăn | Bấm vào trang một cái cho tab được focus, rồi Copy lại. |
| Phần "Console errors" trống | Lỗi xảy ra *trước khi* bạn cài/bật extension. Reload tab rồi tái hiện lại bug. |
| Click không chọn được element | Kiểm tra Inspect đã bật chưa (nút phải sáng xanh, chữ đổi thành "Inspecting"). |
