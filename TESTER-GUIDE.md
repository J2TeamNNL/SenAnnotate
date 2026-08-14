# SenAnnotate — Tester Guide

*[English below](#english) · [Tiếng Việt ở dưới](#tiếng-việt)*

---

## English

The extension helps you file more detailed bug reports: click the broken thing, add a
note, then copy a report that already includes **console errors**, **failed
requests**, and **the steps you just took**.

---

### 1. Install (one-time, ~2 minutes)

**The easy way — from the Chrome Web Store.** Open
[the listing](https://chromewebstore.google.com/detail/senannotate-%E2%80%94-visual-anno/nfplcbaoccfdgfpbkjiigfdpmjphbjla)
and click **Add to Chrome**. It updates itself, and none of the warnings below
apply. Skip to [section 2](#2-how-to-use-it).

**From a zip**, if you were sent a build newer than the Store has reviewed:

1. Unzip `senannotate.zip` into a **permanent** folder — not Downloads, where it
   might get cleaned up. Chrome needs this folder to keep existing.
2. Open Chrome, go to `chrome://extensions`
3. Turn on **Developer mode** (top-right corner)
4. Click **Load unpacked** → pick the unzipped folder (the one containing
   `manifest.json`)
5. Done. An orange **S** icon appears in the toolbar.

> **If you had the old Vuetation build installed:** your saved notes will not
> reappear after updating — the extension's storage namespace changed. Copy out
> any report you need to keep before updating. From this version onward, notes
> persist across reloads as normal.

> **Chrome shows a "Disable developer mode extensions" popup every time it opens.**
> Click **Cancel** (not Disable). This is Chrome's default warning for any
> extension installed this way — not an error.

**When a new build comes in:** replace the files in the same folder, then go to
`chrome://extensions` and click the ⟳ button on SenAnnotate's card. Then
**reload the tab you're testing.**

---

### 2. How to use it

#### Standard workflow

1. **Use the app normally** until you hit a bug. Nothing needs to be turned on
   first — the extension is already recording console errors and failed requests
   from the moment the page loads.
2. When you see a bug, click **Inspect** on the toolbar in the bottom-right corner
   (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>).
3. **Click exactly where the bug is** → type a description → **Add note**.
4. Click the list icon → **Copy report** → paste into Jira/Slack.

> ⚠️ **Important:** use the app *first*, turn on Inspect *after*. While Inspect is
> on, clicks are intercepted by the extension to select an element — the app
> underneath will not receive them.

#### Shortcuts

| Key | Action |
|---|---|
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Toggle Inspect |
| <kbd>1</kbd> | Select by element (default) |
| <kbd>2</kbd> | Select a text span |
| <kbd>3</kbd> | Drag-select multiple elements |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+click | Pick elements one at a time, however far apart (⌘ on macOS) |
| <kbd>Enter</kbd> | Annotate the picked set, or whatever the pointer is over |
| <kbd>F</kbd> | Freeze animations (to catch the exact moment of a bug) |
| <kbd>A</kbd> | Open the notes list |
| <kbd>H</kbd> | Collapse the toolbar to a dot / bring it back |
| <kbd>Esc</kbd> | Cancel / exit Inspect |

#### Tips

- **Bug only happens mid-animation?** Press <kbd>F</kbd> to freeze it, then
  annotate.
- **Toolbar covering the thing you need to look at?** Press <kbd>H</kbd> (or click
  the `»` button on the toolbar) to shrink it to a dot in the corner. The dot keeps
  showing how many notes you have, and clicking it brings the toolbar back. Inspect
  mode keeps working while collapsed — the dot gets an orange ring to say so.
- **Need a screenshot?** The note box has a camera icon — saves a cropped shot of
  the element straight to your Downloads folder.
- **Detail level** is a dropdown next to the Copy button. **Standard** is enough
  by default. Pick **Detailed** if the dev asks for a stack trace too.
- **Orange not your colour?** Click the **gear** on the toolbar to open **Settings** —
  the *Appearance* section has an **Accent colour** row with six presets, a picker for an
  exact colour, and a Reset. It changes the highlight,
  the toolbar, the pins and the marks you draw on a screenshot, straight away.
- Notes are saved per page and survive a reload (F5), and they are kept when the
  extension is updated.

---

### 3. What a report looks like

```markdown
## Page feedback: /buggy.html

### 1. button "Save changes"
**Location:** .settings-card > .save
**Feedback:** Clicking Save does nothing, console shows an error.

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

### 4. About privacy

The extension runs entirely on your machine — **nothing is ever sent anywhere.**
Everything only reaches the clipboard when you actively click Copy.

Things that are **never** recorded:

- **Values you type into a form.** The report only says *"Edited Password"* —
  never the password itself.
- **Request/response bodies.** Only method, path, status code and duration are
  recorded.
- **Tokens in URLs.** Parameters like `access_token`, `api_key`, `signature`… are
  replaced with `[redacted]` before they reach the report.

That said, a report **does** contain page URLs and on-screen text. If you're
testing with real customer data, skim the report before pasting it somewhere
public.

To turn the automatic capture off entirely: click the extension icon → uncheck
**Capture errors & steps**.

---

### 5. Having trouble?

| Symptom | Fix |
|---|---|
| No toolbar visible | Reload the tab. The extension does not run on `chrome://` pages, the Chrome Web Store, or PDF viewers. |
| No badge shown in the toolbar | Normal on a page that isn't a Vue app — annotating and error capture still work fully. A badge only appears when a framework is detected. |
| Copy doesn't seem to work | Click somewhere on the page first to give the tab focus, then Copy again. |
| "Console errors" section is empty | The error happened *before* you installed/enabled the extension. Reload the tab and reproduce the bug again. |
| Clicking doesn't select an element | Check that Inspect is actually on (the button should be lit and read "Inspecting"). |

---

## Tiếng Việt

Extension giúp bạn báo bug chi tiết hơn: click vào chỗ bị lỗi, ghi chú, rồi copy ra
một báo cáo đã kèm sẵn **lỗi console**, **request bị fail**, và **các bước bạn vừa làm**.

---

### 1. Cài đặt (làm 1 lần, ~2 phút)

**Cách dễ nhất — cài từ Chrome Web Store.** Mở
[trang extension](https://chromewebstore.google.com/detail/senannotate-%E2%80%94-visual-anno/nfplcbaoccfdgfpbkjiigfdpmjphbjla)
rồi bấm **Add to Chrome**. Extension tự cập nhật, và không dính cảnh báo nào ở dưới.
Bỏ qua, sang thẳng [mục 2](#2-cách-dùng).

**Cài từ file zip**, nếu bạn được gửi bản mới hơn bản đã lên Store:

1. Giải nén file `senannotate.zip` ra một thư mục **cố định** — đừng để trong Downloads
   rồi xoá, Chrome cần thư mục này tồn tại lâu dài.
2. Mở Chrome, vào `chrome://extensions`
3. Bật **Developer mode** (góc trên bên phải)
4. Bấm **Load unpacked** → chọn thư mục vừa giải nén (thư mục có file `manifest.json`)
5. Xong. Icon chữ **S** màu cam sẽ hiện trên thanh công cụ.

> **Nếu bạn đã cài bản Vuetation cũ:** các note đã lưu sẽ không hiện lại sau khi cập
> nhật, vì extension đổi namespace lưu trữ. Copy report bạn cần giữ ra ngoài trước khi
> cập nhật. Từ bản này trở đi các note vẫn được giữ qua reload như bình thường.

> **Chrome sẽ hiện popup "Disable developer mode extensions" mỗi lần mở.**
> Bấm **Cancel** (đừng bấm Disable). Đây là cảnh báo mặc định của Chrome cho mọi
> extension cài kiểu này, không phải lỗi.

**Khi có bản mới:** thay file trong đúng thư mục cũ, rồi vào `chrome://extensions`
bấm nút ⟳ trên card của SenAnnotate. Sau đó **reload lại tab đang test**.

---

### 2. Cách dùng

#### Quy trình chuẩn

1. **Dùng app bình thường** cho tới khi gặp bug. Không cần bật gì trước —
   extension đã tự ghi lỗi console và request fail ngay từ lúc trang load.
2. Khi thấy bug, bấm **Inspect** trên thanh công cụ góc dưới bên phải
   (hoặc <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>).
3. **Click vào đúng chỗ bị lỗi** → gõ mô tả → **Add note**.
4. Bấm icon danh sách → **Copy report** → paste vào Jira/Slack.

> ⚠️ **Quan trọng:** hãy dùng app *trước*, bật Inspect *sau*. Khi Inspect đang bật,
> click sẽ bị extension giữ lại để chọn element, app sẽ không nhận click đó.

#### Phím tắt

| Phím | Tác dụng |
|---|---|
| <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Bật/tắt Inspect |
| <kbd>1</kbd> | Chọn theo element (mặc định) |
| <kbd>2</kbd> | Chọn theo đoạn text |
| <kbd>3</kbd> | Kéo chọn nhiều element |
| <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+click | Chọn dồn từng element, xa nhau bao nhiêu cũng được (macOS dùng ⌘) |
| <kbd>Enter</kbd> | Ghi chú cho set đã chọn, hoặc cho element đang hover |
| <kbd>F</kbd> | Đóng băng animation (để bắt đúng khoảnh khắc lỗi) |
| <kbd>A</kbd> | Mở danh sách ghi chú |
| <kbd>H</kbd> | Thu toolbar thành một dot / mở lại |
| <kbd>Esc</kbd> | Huỷ / thoát Inspect |

#### Mẹo

- **Bug chỉ xuất hiện lúc animation đang chạy?** Bấm <kbd>F</kbd> để đóng băng, rồi
  mới annotate.
- **Toolbar che đúng chỗ cần xem?** Bấm <kbd>H</kbd> (hoặc nút `»` trên toolbar) để
  thu nó lại thành một dot ở góc. Dot vẫn hiện số ghi chú đang có, click vào là mở
  lại. Inspect vẫn chạy bình thường khi đã thu — lúc đó dot có viền cam để báo.
- **Cần ảnh?** Trong ô ghi chú có icon máy ảnh — lưu ảnh cắt sẵn vùng element vào
  thư mục Downloads.
- **Độ chi tiết** đổi được ở dropdown cạnh nút Copy. Mặc định **Standard** là đủ.
  Chọn **Detailed** nếu dev yêu cầu thêm stack trace.
- **Không thích màu cam?** Bấm **bánh răng** trên toolbar để mở **Settings** — mục
  *Appearance* có hàng **Accent colour**: 6 màu sẵn, một picker chọn màu bất kỳ, và nút Reset. Đổi là ăn ngay: highlight, toolbar, pin số
  và cả nét vẽ trên ảnh screenshot.
- Ghi chú được lưu theo từng trang, F5 không mất, và update extension cũng không mất.

---

### 3. Báo cáo trông như thế nào

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

### 4. Về quyền riêng tư

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

### 5. Gặp vấn đề?

| Hiện tượng | Xử lý |
|---|---|
| Không thấy thanh công cụ | Reload lại tab. Extension không chạy trên `chrome://`, Chrome Web Store, và file PDF. |
| Không thấy badge trên thanh công cụ | Bình thường trên trang không phải app Vue — vẫn annotate và ghi lỗi được đầy đủ. Badge chỉ hiện khi phát hiện được framework. |
| Copy không ăn | Bấm vào trang một cái cho tab được focus, rồi Copy lại. |
| Phần "Console errors" trống | Lỗi xảy ra *trước khi* bạn cài/bật extension. Reload tab rồi tái hiện lại bug. |
| Click không chọn được element | Kiểm tra Inspect đã bật chưa (nút phải sáng xanh, chữ đổi thành "Inspecting"). |
