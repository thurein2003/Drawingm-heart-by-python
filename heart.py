"""Draw a heart with Python's built-in turtle graphics."""

import turtle


screen = turtle.Screen()
screen.title("A heart drawn with Python")
screen.bgcolor("#fffaf7")

pen = turtle.Turtle()
pen.speed(3)
pen.pensize(3)
pen.color("#ed6a5a", "#ffb2a8")
pen.begin_fill()
pen.left(50)
pen.forward(133)
pen.circle(50, 200)
pen.right(140)
pen.circle(50, 200)
pen.forward(133)
pen.end_fill()
pen.hideturtle()

turtle.done()
