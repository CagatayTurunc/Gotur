using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GetirReplica.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCourierEarnings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "TotalEarnings",
                table: "Couriers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalEarnings",
                table: "Couriers");
        }
    }
}
