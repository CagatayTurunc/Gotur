using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace GetirReplica.API.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration config, ILogger<SmtpEmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink)
    {
        var smtpSection = _config.GetSection("Smtp");
        var host     = smtpSection["Host"]     ?? throw new InvalidOperationException("Smtp:Host yapılandırılmamış.");
        var portStr  = smtpSection["Port"]     ?? "587";
        var username = smtpSection["Username"] ?? throw new InvalidOperationException("Smtp:Username yapılandırılmamış.");
        var password = smtpSection["Password"] ?? throw new InvalidOperationException("Smtp:Password yapılandırılmamış.");
        var fromName = smtpSection["FromName"] ?? "Götür";
        var fromAddr = smtpSection["FromAddress"] ?? username;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddr));
        message.To.Add(new MailboxAddress(fullName, toEmail));
        message.Subject = "Şifre Sıfırlama Talebi – Götür";

        var body = new BodyBuilder
        {
            HtmlBody = BuildHtmlBody(fullName, resetLink),
            TextBody = $"Merhaba {fullName},\n\nŞifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın (30 dakika geçerlidir):\n\n{resetLink}\n\nBu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz."
        };
        message.Body = body.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(host, int.Parse(portStr), SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(username, password);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);

        _logger.LogInformation("Şifre sıfırlama maili {Email} adresine gönderildi.", toEmail);
    }

    private static string BuildHtmlBody(string fullName, string resetLink) => $"""
        <!DOCTYPE html>
        <html lang="tr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Şifre Sıfırlama</title>
        </head>
        <body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="background:#9a0002;padding:32px 40px;text-align:center;">
                      <span style="font-size:28px;font-weight:900;font-style:italic;color:#ffffff;letter-spacing:-0.5px;">Götür</span>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 40px 32px;">
                      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">Şifrenizi Sıfırlayın</p>
                      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
                        Merhaba <strong>{fullName}</strong>, hesabınız için bir şifre sıfırlama talebi aldık.
                        Şifrenizi sıfırlamak için aşağıdaki butona tıklayın.
                      </p>
                      <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;">
                        <tr>
                          <td align="center">
                            <a href="{resetLink}"
                               style="display:inline-block;background:#9a0002;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:50px;letter-spacing:0.3px;">
                              Şifremi Sıfırla
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.5;">
                        Bu butona tıklayamıyorsanız aşağıdaki bağlantıyı tarayıcınıza kopyalayın:
                      </p>
                      <p style="margin:0 0 24px;font-size:11px;color:#9a0002;word-break:break-all;">{resetLink}</p>
                      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 18px;">
                        <p style="margin:0;font-size:12px;color:#991b1b;line-height:1.5;">
                          ⏱ Bu bağlantı <strong>30 dakika</strong> süreyle geçerlidir.<br/>
                          Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.
                        </p>
                      </div>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px 32px;border-top:1px solid #f3f4f6;">
                      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">
                        Bu e-posta Götür sistemi tarafından otomatik olarak gönderilmiştir.<br/>
                        Lütfen bu adresi yanıtlamayın.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;
}
