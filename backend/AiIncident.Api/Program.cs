using AiIncident.Api.Data;
using AiIncident.Api.GraphQL;
using AiIncident.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text.Json.Serialization;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:4200"])
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
{
    var configured = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=data/app.db";
    var dbPath = System.IO.Path.GetFullPath(System.IO.Path.Combine(builder.Environment.ContentRootPath, "..", "data", "app.db"));
    var connectionString = configured.Contains("Data Source=", StringComparison.OrdinalIgnoreCase)
        ? $"Data Source={dbPath}"
        : configured;
    options.UseSqlite(connectionString);
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var signingKey = builder.Configuration["Jwt:SigningKey"] ?? "dev-only-signing-key-change-me";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "ai-incident-api",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "ai-incident-dashboard-spa",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        // Allow the JWT access token to be passed via the "access_token" query string for SignalR
        // transports (WebSockets) where the Authorization header may not be available.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"].FirstOrDefault();
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .AddAuthenticationSchemes(JwtBearerDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();
builder.Services.AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IAiAssistant, StubAiAssistant>();
builder.Services.AddScoped<IRefreshTokenStore, DbRefreshTokenStore>();

// SignalR for realtime updates
builder.Services.AddSignalR();

// Optional Redis backplane for scaling across nodes. Configure in appsettings or environment.
// NOTE: To enable a Redis backplane, install the package
// Microsoft.AspNetCore.SignalR.StackExchangeRedis and then call
// builder.Services.AddSignalR().AddStackExchangeRedis("<connection>");
// We intentionally do not call AddStackExchangeRedis here to avoid a hard dependency in the sample project.

builder.Services
    .AddGraphQLServer()
    .AddAuthorization()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

if (!app.Environment.IsEnvironment("Test"))
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        db.Database.EnsureCreated();
        AppSeeder.Seed(db, hasher);
    }
}

app.MapControllers();
app.MapGraphQL("/graphql").RequireAuthorization();

// Map SignalR hubs
app.MapHub<TicketHub>("/hubs/tickets");

app.Run();

public partial class Program;
