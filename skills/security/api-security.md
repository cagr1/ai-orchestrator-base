Stack: General API Security

Contexto:
APIs públicas expuestas a internet.
Protección contra ataques comunes.

Responsabilidades:
- Rate limiting
- CORS correcto
- Input validation
- SQL injection prevention
- XSS prevention

Restricciones:
- NO CORS con wildcard (*) en producción
- NO confiar en inputs del cliente
- NO queries SQL con string concatenation
- NO HTML sin sanitizar

Middleware esenciales (.NET):
```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("Production", policy =>
    {
        policy.WithOrigins("https://app.domain.com")
              .AllowMethods("GET", "POST", "PUT", "DELETE")
              .AllowHeaders("Content-Type", "Authorization")
              .AllowCredentials();
    });
});

// Rate limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 60;
    });
});
```

Input validation:
```csharp
// DTO con validaciones
public class CreateProductDto
{
    [Required]
    [StringLength(255, MinimumLength = 3)]
    [RegularExpression(@"^[a-zA-Z0-9\s-]+$")]
    public string Name { get; set; }
    
    [Range(0.01, 999999.99)]
    public decimal Price { get; set; }
}
```

Middleware Node.js:
```js
// rate-limit.js
import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15min
  max: 100,
  message: 'Too many requests'
})

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true
}))

// Helmet
app.use(helmet())
```

Forma de responder:
1. Middleware de seguridad
2. Configuración
3. Casos de uso

Red flags:
- CORS en * 
- No validar inputs
- SQL injection posible
- Secrets en logs
- Errores con stack trace en producción