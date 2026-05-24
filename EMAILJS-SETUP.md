# إعداد EmailJS لإرسال التقارير

1. أنشئ حساباً على [EmailJS](https://www.emailjs.com/)
2. أضف **Email Service** (Gmail أو SMTP)
3. أنشئ **Email Template** بالمتغيرات:
   - `{{to_email}}`
   - `{{subject}}`
   - `{{message}}`
   - `{{center_name}}`
   - `{{specialist_name}}`
   - `{{attachment_name}}` (اختياري)
   - `{{attachment_data}}` (base64 PDF — إن دعم القالب المرفقات)

4. ضع القيم في `config.js`:

```javascript
window.EMAILJS_CONFIG = {
    serviceId: 'service_xxxxx',
    templateId: 'template_xxxxx',
    publicKey: 'your_public_key'
};
```

5. في قالب EmailJS فعّل **Attachments** إذا أردت إرسال PDF فعلياً كمرفق.
