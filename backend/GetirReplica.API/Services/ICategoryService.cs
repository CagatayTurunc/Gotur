using GetirReplica.API.Models.DTOs;

namespace GetirReplica.API.Services.Interfaces;

public interface ICategoryService
{
    Task<CategoryDto> CreateAsync(CreateCategoryDto dto);

    Task<List<CategoryDto>> GetAllAsync();

    Task<CategoryDto?> GetByIdAsync(Guid id);

    Task<bool> DeleteAsync(Guid id);
}