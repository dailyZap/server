import { User } from "../../../models/User";

// A post request should not contain an id.
export type UserCreationParams = Pick<User, "email" | "name" | "phoneNumbers">;

// src/users/usersController.ts
import { Body, Controller, Get, Path, Post, Query, Route, SuccessResponse } from "tsoa";

@Route("users")
export class UsersController extends Controller {
    @Get("{userId}")
    public async getUser(@Path() userId: number, @Query() name?: string): Promise<User> {
        return {
            id: userId,
            email: "jane@doe.com",
            name: name ?? "Jane Doe",
            status: "Happy",
            phoneNumbers: [],
        };
    }

    @SuccessResponse("201", "Created") // Custom success response
    @Post()
    public async createUser(@Body() requestBody: UserCreationParams): Promise<void> {
        this.setStatus(201); // set return status 201
        requestBody;
        return;
    }
}
