using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using PatientVisitManager.Api.Repositories.Interfaces;
using PatientVisitManager.Api.Services.Interfaces;
using PatientVisitManager.Api.Security;
using PatientVisitManager.Api.Models;

namespace PatientVisitManager.Api.Services;
public class AuthService : IAuthService
{
    private readonly IUserRepository _users;
    private readonly IConfiguration _cfg;
    public AuthService(IUserRepository users, IConfiguration cfg) { _users = users; _cfg = cfg; }

    public async Task<int> RegisterAsync(string email, string password, string role)
    {
        var existing = await _users.GetByEmailAsync(email);
        if (existing != null) throw new InvalidOperationException("Email already exists.");
        var (hash, salt) = PasswordHasher.HashPassword(password);
        var user = new User { Email = email, PasswordHash = hash, PasswordSalt = salt, Role = role };
        return await _users.CreateAsync(user);
    }

    public async Task<(bool Ok, string? Role, string? Token, string? Error)> LoginAsync(string email, string password)
    {
        var user = await _users.GetByEmailAsync(email);
        if (user == null || !user.IsActive) return (false, null, null, "Invalid credentials.");
        if (!PasswordHasher.Verify(password, user.PasswordHash, user.PasswordSalt)) return (false, null, null, "Invalid credentials.");
        var token = GenerateJwt(user);
        return (true, user.Role, token, null);
    }

    public async Task<(bool Ok, string? Error)> ChangePasswordAsync(string email, string current, string next)
    {
        var user = await _users.GetByEmailAsync(email);
        if (user == null) return (false, "User not found.");
        if (!PasswordHasher.Verify(current, user.PasswordHash, user.PasswordSalt)) return (false, "Current password incorrect.");
        var (hash, salt) = PasswordHasher.HashPassword(next);
        await _users.UpdatePasswordAsync(user.Id, hash, salt);
        return (true, null);
    }

    private string GenerateJwt(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_cfg["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiryMinutes = int.Parse(_cfg["Jwt:ExpiryMinutes"] ?? "60");
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Email),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("uid", user.Id.ToString())
        };
        var token = new JwtSecurityToken(
            issuer: _cfg["Jwt:Issuer"],
            audience: _cfg["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(60),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
