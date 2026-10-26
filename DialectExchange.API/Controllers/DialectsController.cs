using DialectExchange.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DialectExchange.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DialectsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DialectsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetDialects()
        {
            var dialects = await _context.Dialects
                .Where(d => d.IsActive)
                .OrderBy(d => d.NameEn)
                .ToListAsync();

            return Ok(dialects);
        }
    }
}