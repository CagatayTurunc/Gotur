using GetirReplica.API.Models.DTOs;
using GetirReplica.API.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace GetirReplica.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;

    public CategoriesController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateCategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(new
            {
                message = "Kategori adı boş bırakılamaz."
            });
        }

        try
        {
            var category = await _categoryService.CreateAsync(dto);
            return CreatedAtAction(
                nameof(GetById),
                new { id = category.Id },
                category);
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new
            {
                message = exception.Message
            });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _categoryService.GetAllAsync();
        return Ok(categories);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var category = await _categoryService.GetByIdAsync(id);

        if (category is null)
        {
            return NotFound(new
            {
                message = "Kategori bulunamadı."
            });
        }

        return Ok(category);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var deleted = await _categoryService.DeleteAsync(id);

        if (!deleted)
        {
            return NotFound(new
            {
                message = "Kategori bulunamadı."
            });
        }

        return Ok(new
        {
            message = "Kategori başarıyla silindi."
        });
    }
}