using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GetirReplica.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Restaurants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsOpen",
                table: "Restaurants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "Restaurants",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "IsOpen",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "Restaurants");
        }
    }
}
