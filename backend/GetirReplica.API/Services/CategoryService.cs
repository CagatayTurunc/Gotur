using GetirReplica.API.Data;
using GetirReplica.API.Models.DTOs;
using GetirReplica.API.Models.Entities;
using GetirReplica.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GetirReplica.API.Services;

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _context;

    public CategoryService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryDto dto)
    {
        var categoryName = dto.Name.Trim();

        var categoryExists = await _context.Categories
            .AnyAsync(c => c.Name.ToLower() == categoryName.ToLower());

        if (categoryExists)
        {
            throw new InvalidOperationException("Bu kategori zaten mevcut.");
        }

        var category = new Category
        {
            Name = categoryName,
            Description = dto.Description?.Trim()
        };

        _context.Categories.Add(category);
        await _context.SaveChangesAsync();

        return MapToDto(category);
    }

    public async Task<List<CategoryDto>> GetAllAsync()
    {
        return await _context.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<CategoryDto?> GetByIdAsync(Guid id)
    {
        return await _context.Categories
            .AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                CreatedAt = c.CreatedAt
            })
            .FirstOrDefaultAsync();
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var category = await _context.Categories
            .FirstOrDefaultAsync(c => c.Id == id);

        if (category is null)
        {
            return false;
        }

        _context.Categories.Remove(category);
        await _context.SaveChangesAsync();

        return true;
    }

    private static CategoryDto MapToDto(Category category)
    {
        return new CategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            CreatedAt = category.CreatedAt
        };
    }
}