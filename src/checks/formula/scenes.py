from manim import *

# 自检用的 Manim 场景：直角三角形 + 勾股定理的公式变形，透明背景，嵌进 FormulaCheck。
# 渲染：npm run manim -- src/checks/formula/scenes.py

INK = "#1d1d1f"
BLUE = "#2563eb"
ORANGE = "#ea580c"


class PythagorasMorph(Scene):
    def construct(self):
        a_point, b_point, c_point = LEFT * 6 + DOWN * 1.5, LEFT * 2 + DOWN * 1.5, LEFT * 2 + UP * 1.5
        triangle = Polygon(a_point, b_point, c_point, color=INK, stroke_width=6)
        corner = Square(0.35, color=INK, stroke_width=4).move_to(b_point + UL * 0.175 * np.sqrt(2))
        labels = VGroup(
            MathTex("a", color=BLUE).scale(1.4).next_to(Line(a_point, b_point), DOWN),
            MathTex("b", color=BLUE).scale(1.4).next_to(Line(b_point, c_point), RIGHT),
            MathTex("c", color=ORANGE).scale(1.4).move_to((a_point + c_point) / 2 + UL * 0.45),
        )

        title = Text("勾股定理", font="Noto Sans SC", color=ORANGE).scale(0.9).move_to(RIGHT * 3 + UP * 1.6)
        before = MathTex("a^2", "+", "b^2", "=", "c^2", color=INK).scale(1.8).move_to(RIGHT * 3 + DOWN * 0.3)
        after = MathTex("c", "=", r"\sqrt{a^2+b^2}", color=INK).scale(1.8).move_to(before)

        self.play(Create(triangle), FadeIn(corner), run_time=0.8)
        self.play(Write(labels), FadeIn(title, shift=DOWN * 0.2), run_time=0.6)
        self.play(Write(before), run_time=0.8)
        self.wait(0.4)
        self.play(TransformMatchingTex(before, after), run_time=1)
        self.wait(0.4)
