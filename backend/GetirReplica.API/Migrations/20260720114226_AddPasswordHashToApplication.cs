using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GetirReplica.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPasswordHashToApplication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                table: "RestaurantApplications",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordHash",
                table: "RestaurantApplications");
        }
    }
}
