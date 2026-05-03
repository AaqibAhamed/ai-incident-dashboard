using AiIncident.Api.Data;
using AiIncident.Api.Models;

namespace AiIncident.Api.Services;

public sealed class DbRefreshTokenStore(AppDbContext db) : IRefreshTokenStore
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    public void Save(string refreshToken, string userId)
    {
        db.RefreshTokens.Add(new RefreshTokenRecord
        {
            Token = refreshToken,
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.Add(Lifetime)
        });
        db.SaveChanges();
    }

    public bool TryGetUser(string refreshToken, out string userId)
    {
        userId = "";
        var row = db.RefreshTokens.FirstOrDefault(x => x.Token == refreshToken);
        if (row is null || row.ExpiresAt < DateTime.UtcNow)
        {
            return false;
        }

        userId = row.UserId;
        return true;
    }
}
